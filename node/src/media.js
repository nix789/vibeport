/**
 * media.js
 * Handles image/video uploads for bulletin posts.
 *
 * Rules:
 *   - Images: max 10 MB, stored as-is
 *   - Videos: max 75 MB pre-upload; if > 25 MB after receive, compress with ffmpeg
 *   - All media posts auto-delete 72 hours after creation
 *   - Files are stored in data/media/ (local only, never cloud)
 */

import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { getDB } from './store.js'

const execFileAsync = promisify(execFile)

const __dirname  = path.dirname(fileURLToPath(import.meta.url))
const MEDIA_DIR  = path.resolve(__dirname, '../../data/media')
const IMAGE_MAX  = 10 * 1024 * 1024   // 10 MB
const VIDEO_MAX  = 75 * 1024 * 1024   // 75 MB
const COMPRESS_THRESHOLD = 25 * 1024 * 1024  // compress videos over 25 MB
const EXPIRY_SECONDS = 72 * 60 * 60           // 72 hours

fs.mkdirSync(MEDIA_DIR, { recursive: true })

// ── Storage ───────────────────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, MEDIA_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '')
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: VIDEO_MAX },
  fileFilter(req, file, cb) {
    const isImage = file.mimetype.startsWith('image/')
    const isVideo = file.mimetype.startsWith('video/')
    if (!isImage && !isVideo) {
      return cb(new Error('Only images and videos are allowed'))
    }
    cb(null, true)
  },
})

// ── Video compression ─────────────────────────────────────────────────────────

async function ffmpegAvailable() {
  try {
    await execFileAsync('ffmpeg', ['-version'])
    return true
  } catch {
    return false
  }
}

async function compressVideo(inputPath) {
  const ext  = path.extname(inputPath)
  const out  = inputPath.replace(ext, `-c${ext === '.mp4' ? '.mp4' : '.mp4'}`)

  // Two-pass CRF encode: good quality, half the size on average
  await execFileAsync('ffmpeg', [
    '-i', inputPath,
    '-vcodec', 'libx264',
    '-crf', '28',          // 23=default, 28=smaller file, 51=worst
    '-preset', 'fast',
    '-acodec', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    '-y', out,
  ])

  // Replace original with compressed
  fs.unlinkSync(inputPath)
  fs.renameSync(out, inputPath)

  const { size } = fs.statSync(inputPath)
  return size
}

// ── Router ────────────────────────────────────────────────────────────────────

export function mediaRouter() {
  const router = express.Router()

  // POST /api/media/upload
  router.post('/upload', upload.single('media'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file received' })

    const { path: filePath, mimetype, size } = req.file

    // Enforce image size after multer receives it
    if (mimetype.startsWith('image/') && size > IMAGE_MAX) {
      fs.unlinkSync(filePath)
      return res.status(400).json({ error: `Image exceeds 10 MB (got ${(size/1024/1024).toFixed(1)} MB)` })
    }

    let finalSize = size
    let compressed = false

    // Compress video if it's large enough to bother
    if (mimetype.startsWith('video/') && size > COMPRESS_THRESHOLD) {
      if (await ffmpegAvailable()) {
        try {
          finalSize = await compressVideo(filePath)
          compressed = true
          console.log(`[media] Compressed video: ${(size/1024/1024).toFixed(1)} MB → ${(finalSize/1024/1024).toFixed(1)} MB`)
        } catch (err) {
          console.error('[media] ffmpeg error:', err.message)
          // Serve as-is if compression fails
        }
      } else {
        console.warn('[media] ffmpeg not found — skipping compression')
      }
    }

    // Record in DB with expiry timestamp
    const db = getDB()
    const relativePath = '/media/' + path.basename(filePath)
    const expiresAt    = Math.floor(Date.now() / 1000) + EXPIRY_SECONDS

    db.prepare(`
      ALTER TABLE posts ADD COLUMN media          TEXT
    `).catch?.(() => {}) // column may already exist

    // We store media metadata in a separate table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS media_files (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        filename   TEXT    NOT NULL UNIQUE,
        mime_type  TEXT    NOT NULL,
        size_bytes INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `).run()

    db.prepare(`
      INSERT INTO media_files (filename, mime_type, size_bytes, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(path.basename(filePath), mimetype, finalSize, expiresAt)

    res.json({
      path: relativePath,
      mimeType: mimetype,
      size: finalSize,
      compressed,
      expiresAt,
    })
  })

  // GET /media/:filename — serve the actual file
  router.get('/:filename', (req, res) => {
    const filename = path.basename(req.params.filename) // prevent path traversal
    const filePath = path.join(MEDIA_DIR, filename)

    // Check expiry
    const db  = getDB()
    const row = db.prepare('SELECT expires_at FROM media_files WHERE filename = ?').get(filename)

    if (!row) return res.status(404).json({ error: 'Not found' })
    if (row.expires_at < Math.floor(Date.now() / 1000)) {
      // Already expired — delete and 410 Gone
      try { fs.unlinkSync(filePath) } catch {}
      db.prepare('DELETE FROM media_files WHERE filename = ?').run(filename)
      return res.status(410).json({ error: 'Media expired and deleted' })
    }

    res.sendFile(filePath)
  })

  return router
}

// ── Cleanup job ───────────────────────────────────────────────────────────────
// Runs every hour to delete expired media files and their DB records.

export function startMediaCleanup() {
  const INTERVAL = 60 * 60 * 1000 // 1 hour

  const sweep = () => {
    const db  = getDB()

    // Create table if not yet created (node startup before first upload)
    db.prepare(`
      CREATE TABLE IF NOT EXISTS media_files (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        filename   TEXT    NOT NULL UNIQUE,
        mime_type  TEXT    NOT NULL,
        size_bytes INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `).run()

    const now     = Math.floor(Date.now() / 1000)
    const expired = db.prepare('SELECT filename FROM media_files WHERE expires_at < ?').all(now)

    for (const { filename } of expired) {
      const filePath = path.join(MEDIA_DIR, path.basename(filename))
      try {
        fs.unlinkSync(filePath)
        console.log(`[media] Deleted expired file: ${filename}`)
      } catch {
        // file may already be gone
      }
    }

    if (expired.length > 0) {
      db.prepare('DELETE FROM media_files WHERE expires_at < ?').run(now)
      console.log(`[media] Swept ${expired.length} expired media file(s)`)
    }
  }

  sweep() // run once at startup
  setInterval(sweep, INTERVAL)
}
