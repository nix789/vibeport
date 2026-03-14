/**
 * api.js
 * Local HTTP API server (localhost only).
 * The React frontend talks to this — it never touches the internet.
 */

import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import path from 'path'
import { fileURLToPath } from 'url'
import { getDB } from './store.js'
import { appendEvent, addFriend, getLocalCoreKey } from './p2p.js'
import { sanitizeCSS, sanitizeHTML } from './sanitize.js'
import { mediaRouter } from './media.js'
import { connectRelay, disconnectRelay, getRelayStatus } from './relay-client.js'

import multer from 'multer'
import fs from 'fs'

const __dirname   = path.dirname(fileURLToPath(import.meta.url))
const MEDIA_DIR   = path.resolve(__dirname, '../../data/media')
const AVATAR_DIR  = path.resolve(__dirname, '../../data/avatars')
const AVATAR_MAX  = 5 * 1024 * 1024   // 5 MB

fs.mkdirSync(AVATAR_DIR, { recursive: true })

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, AVATAR_DIR),
    filename:    (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '')
      cb(null, `avatar${ext}`)   // always overwrites — one avatar per node
    },
  }),
  limits: { fileSize: AVATAR_MAX },
  fileFilter (req, file, cb) {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Images only'))
    }
    cb(null, true)
  },
})
const PORT = 7331 // local only

export function startAPI() {
  const app = express()

  // Only accept connections from localhost
  app.use((req, res, next) => {
    const ip = req.socket.remoteAddress
    if (ip !== '127.0.0.1' && ip !== '::1' && ip !== '::ffff:127.0.0.1') {
      return res.status(403).json({ error: 'Local only' })
    }
    next()
  })

  app.use(cors({ origin: 'http://localhost:5173' }))
  app.use(express.json({ limit: '128kb' }))
  app.use(rateLimit({ windowMs: 60_000, max: 120 }))

  // Media upload + file serving (multer handles its own body parsing)
  app.use('/api/media', mediaRouter())
  app.use('/media',   express.static(MEDIA_DIR))
  app.use('/avatars', express.static(AVATAR_DIR))

  // ── Identity ────────────────────────────────────────────────────────────────

  app.get('/api/identity', (req, res) => {
    const coreKey = getLocalCoreKey()
    res.json({ coreKey })
  })

  // ── Profile ─────────────────────────────────────────────────────────────────

  app.get('/api/profile', (req, res) => {
    const db = getDB()
    const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get()
    res.json(profile)
  })

  app.patch('/api/profile', async (req, res) => {
    const db = getDB()
    const { handle, bio, song_url, custom_css, custom_html } = req.body

    const safeCSS  = custom_css  ? sanitizeCSS(custom_css)   : undefined
    const safeHTML = custom_html ? sanitizeHTML(custom_html)  : undefined

    const fields = {}
    if (handle     !== undefined) fields.handle     = String(handle).slice(0, 64)
    if (bio        !== undefined) fields.bio        = String(bio).slice(0, 500)
    if (song_url   !== undefined) fields.song_url   = String(song_url).slice(0, 512)
    if (safeCSS    !== undefined) fields.custom_css  = safeCSS
    if (safeHTML   !== undefined) fields.custom_html = safeHTML

    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: 'Nothing to update' })
    }

    fields.updated_at = Math.floor(Date.now() / 1000)

    const setClause = Object.keys(fields).map(k => `${k} = @${k}`).join(', ')
    db.prepare(`UPDATE profile SET ${setClause} WHERE id = 1`).run(fields)

    // Broadcast update to peers via Hypercore
    const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get()
    await appendEvent('profile_update', profile)

    res.json({ ok: true })
  })

  // ── Avatar upload ─────────────────────────────────────────────────────────────

  app.post('/api/profile/avatar', avatarUpload.single('avatar'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file received' })

    const db  = getDB()
    const url = `/avatars/${req.file.filename}`
    db.prepare(`UPDATE profile SET avatar = ?, updated_at = unixepoch() WHERE id = 1`).run(url)

    const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get()
    await appendEvent('profile_update', profile)

    res.json({ url })
  })

  // ── Posts ────────────────────────────────────────────────────────────────────

  app.get('/api/posts', (req, res) => {
    const db = getDB()
    // Join with media_files to get expiry and mime type
    const posts = db.prepare(`
      SELECT p.*,
             mf.expires_at  AS media_expires_at,
             mf.mime_type   AS media_type
      FROM posts p
      LEFT JOIN media_files mf ON mf.filename = REPLACE(p.media, '/media/', '')
      ORDER BY p.created_at DESC
      LIMIT 50
    `).all()
    res.json(posts)
  })

  app.post('/api/posts', async (req, res) => {
    const db = getDB()
    const { content, mood, media } = req.body
    if (!content && !media) {
      return res.status(400).json({ error: 'content or media required' })
    }

    const result = db.prepare(`
      INSERT INTO posts (content, mood, media) VALUES (?, ?, ?)
    `).run(
      (content ?? '').slice(0, 2000),
      (mood ?? '').slice(0, 32),
      media ?? null,
    )

    await appendEvent('new_post', { id: result.lastInsertRowid, content, mood, media })
    res.json({ id: result.lastInsertRowid })
  })

  // ── Friends ──────────────────────────────────────────────────────────────────

  app.get('/api/friends', (req, res) => {
    const db = getDB()
    const friends = db.prepare(`
      SELECT f.address, f.handle, f.added_at, f.last_seen,
             fp.bio, fp.custom_css, fp.custom_html, fp.song_url
      FROM friends f
      LEFT JOIN friend_profiles fp ON fp.address = f.address
      ORDER BY f.added_at DESC
    `).all()
    res.json(friends)
  })

  app.post('/api/friends', async (req, res) => {
    const { coreKey } = req.body
    if (!coreKey || !/^[0-9a-f]{64}$/i.test(coreKey)) {
      return res.status(400).json({ error: 'Invalid core key (must be 64-char hex)' })
    }
    await addFriend(coreKey)
    res.json({ ok: true })
  })

  // ── Stickers ─────────────────────────────────────────────────────────────────

  app.post('/api/stickers/send', async (req, res) => {
    const db = getDB()
    const { peer, sticker_id, message } = req.body
    if (!peer || !sticker_id) {
      return res.status(400).json({ error: 'peer and sticker_id required' })
    }

    db.prepare(`
      INSERT INTO stickers (direction, peer, sticker_id, message)
      VALUES ('sent', ?, ?, ?)
    `).run(peer, sticker_id, (message ?? '').slice(0, 200))

    await appendEvent('sticker_sent', { peer, sticker_id, message })
    res.json({ ok: true })
  })

  app.get('/api/stickers', (req, res) => {
    const db = getDB()
    const stickers = db.prepare('SELECT * FROM stickers ORDER BY created_at DESC LIMIT 100').all()
    res.json(stickers)
  })

  // ── Webrings ─────────────────────────────────────────────────────────────────

  app.get('/api/webrings', (req, res) => {
    const db = getDB()
    res.json(db.prepare('SELECT * FROM webrings ORDER BY joined_at DESC').all())
  })

  app.post('/api/webrings', (req, res) => {
    const db = getDB()
    const { name, topic_key } = req.body
    if (!name || !topic_key) {
      return res.status(400).json({ error: 'name and topic_key required' })
    }
    db.prepare(`
      INSERT OR IGNORE INTO webrings (name, topic_key) VALUES (?, ?)
    `).run(name.slice(0, 64), topic_key.slice(0, 64))
    res.json({ ok: true })
  })

  // ── Relays ────────────────────────────────────────────────────────────────────

  app.get('/api/relays', (req, res) => {
    const db = getDB()
    const saved  = db.prepare('SELECT * FROM relays ORDER BY added_at DESC').all()
    const status = getRelayStatus()
    const byUrl  = Object.fromEntries(status.map(s => [s.url, s.connected]))
    res.json(saved.map(r => ({ ...r, connected: byUrl[r.url] ?? false })))
  })

  app.post('/api/relays', (req, res) => {
    const db = getDB()
    const { url } = req.body
    if (!url || !/^wss?:\/\/.+/.test(url)) {
      return res.status(400).json({ error: 'Invalid relay URL (must start with ws:// or wss://)' })
    }
    db.prepare('INSERT OR IGNORE INTO relays (url) VALUES (?)').run(url)
    connectRelay(url)
    res.json({ ok: true })
  })

  app.delete('/api/relays/:id', (req, res) => {
    const db = getDB()
    const row = db.prepare('SELECT url FROM relays WHERE id = ?').get(req.params.id)
    if (!row) return res.status(404).json({ error: 'Not found' })
    db.prepare('DELETE FROM relays WHERE id = ?').run(req.params.id)
    disconnectRelay(row.url)
    res.json({ ok: true })
  })

  // ── Health ────────────────────────────────────────────────────────────────────

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }))

  app.listen(PORT, '127.0.0.1', () => {
    console.log(`[api] Local API running at http://127.0.0.1:${PORT}`)
  })
}
