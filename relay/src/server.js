/**
 * server.js
 * Vibeport Relay — WebSocket server.
 *
 * Protocol (JSON control messages + binary event frames):
 *
 *   Client → Relay (JSON):
 *     { type: "SUBSCRIBE",  feedKey: "<hex>" [, fromSeq: N] }
 *     { type: "UNSUBSCRIBE",feedKey: "<hex>" }
 *     { type: "INFO" }                          ← relay stats
 *
 *   Client → Relay (binary):
 *     Signed event buffer (see verify.js for wire format)
 *     Relay verifies signature, stores it, forwards to subscribers.
 *
 *   Relay → Client (JSON):
 *     { type: "OK",    feedKey, seq }           ← event accepted
 *     { type: "ERROR", message }
 *     { type: "INFO",  ... }
 *     { type: "SUBSCRIBED", feedKey, head }     ← after SUBSCRIBE
 *
 *   Relay → Client (binary):
 *     Forwarded signed event buffers (same format as published)
 */

import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { WebSocketServer, WebSocket } from 'ws'
import { storeEvent, getEvents, getHead, evictOldFeeds } from './db.js'
import { unpackEvent, HEADER_BYTES } from './verify.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// feedKey → Set<WebSocket>
const subscriptions = new Map()

// nodeKey → { handle, bio, custom_css, avatar, posts, updatedAt, expiryTimer, isSeed }
const profileCache = new Map()

// ws → nodeKey (so we know which profile to expire on disconnect)
const wsToProfileKey = new WeakMap()

// ── Pre-load seed profiles ─────────────────────────────────────────────────────
// seeds.json lives alongside server.js in the deployed flat directory
const SEEDS_PATH = fs.existsSync(path.join(__dirname, 'seeds.json'))
  ? path.join(__dirname, 'seeds.json')
  : path.join(__dirname, '../seeds.json')
if (fs.existsSync(SEEDS_PATH)) {
  try {
    const seeds = JSON.parse(fs.readFileSync(SEEDS_PATH, 'utf8'))
    for (const s of seeds) {
      if (s.nodeKey && /^[0-9a-f]{64}$/.test(s.nodeKey)) {
        profileCache.set(s.nodeKey.toLowerCase(), {
          handle:     s.handle     ?? '',
          bio:        s.bio        ?? '',
          custom_css: s.custom_css ?? '',
          avatar:     s.avatar     ?? null,
          posts:      s.posts      ?? [],
          updatedAt:  s.updatedAt  ?? Date.now(),
          expiryTimer: null,
          isSeed: true,   // seeds never expire
        })
      }
    }
    console.log(`[relay] Loaded ${seeds.length} seed profiles from seeds.json`)
  } catch (e) {
    console.warn('[relay] Could not load seeds.json:', e.message)
  }
}

// ── Vibes / Spaces (WebRTC signaling) ────────────────────────────────────────
// spaceId → {
//   id, hostKey, coHostKey, title,
//   host:      WebSocket,
//   speakers:  Map<peerKey, WebSocket>,   // co-host + speakers (excl. host)
//   listeners: Map<peerKey, WebSocket>,
// }
const spaces = new Map()
const MAX_STAGE = 10   // host + speakers combined

function spaceSend(ws, obj) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj))
}

// Find the WebSocket for any participant in a space
function findWS(space, peerKey) {
  if (space.hostKey === peerKey) return space.host
  return space.speakers.get(peerKey) ?? space.listeners.get(peerKey)
}

// All stage keys (host + speakers)
function stageKeys(space) {
  return [space.hostKey, ...space.speakers.keys()]
}

function broadcastToStage(space, obj) {
  spaceSend(space.host, obj)
  for (const ws of space.speakers.values()) spaceSend(ws, obj)
}

function broadcastToAll(space, obj) {
  broadcastToStage(space, obj)
  for (const ws of space.listeners.values()) spaceSend(ws, obj)
}

function broadcastSpaceList() {
  const list = [...spaces.values()].map(s => ({
    id:        s.id,
    hostKey:   s.hostKey,
    title:     s.title,
    listeners: s.listeners.size,
    live:      true,
  }))
  const subs = subscriptions.get('spaces') ?? new Set()
  for (const ws of subs) spaceSend(ws, { type: 'SPACES_LIST', spaces: list })
}

export function startServer(port, rateLimitPerMin = 300) {
  // ── HTTP server for profile cache endpoint ──────────────────────────────────
  const PROFILE_TTL_MS = 24 * 60 * 60 * 1000  // 24 hours

  const TAGLINES = [
    'running their own node on the decentralized web',
    'no algorithm, no ads, no landlord',
    'owns their data and their identity',
    'part of the peer-to-peer internet',
    'on vibeport — the anti-platform',
    'your port, your vibe, your people',
    'escaped the cloud. running local.',
    'decentralized and unbothered',
    'building the internet we actually want',
    'no follower counts. just real connections.',
  ]

  function tagline(key) {
    const n = parseInt(key.slice(0, 8), 16)
    return TAGLINES[n % TAGLINES.length]
  }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  function buildPreviewHTML(key, profile) {
    const handle = profile?.handle || 'A Vibeport Node'
    const bio    = profile?.bio    || tagline(key)
    const short  = key.slice(0, 16) + '…' + key.slice(-8)
    const appUrl = `https://vibeport.nixdata.net/?nodekey=${key}`
    const ogImg  = 'https://vibeport.nixdata.net/logo.png'
    const posts  = profile?.posts ?? []

    const postsHTML = posts.slice(0, 3).map(p => `
      <div style="border-left:2px solid #1a3a1a;padding:.5rem .75rem;margin:.5rem 0;color:#666;font-size:.82rem;line-height:1.5">
        ${p.mood ? `<span style="margin-right:.4rem">${esc(p.mood)}</span>` : ''}
        ${esc(p.content?.slice(0, 140))}
      </div>`).join('')

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${esc(handle)} — Vibeport</title>

  <!-- Open Graph -->
  <meta property="og:type"        content="profile"/>
  <meta property="og:site_name"   content="Vibeport"/>
  <meta property="og:title"       content="${esc(handle)} — Vibeport"/>
  <meta property="og:description" content="${esc(bio)}"/>
  <meta property="og:image"       content="${ogImg}"/>
  <meta property="og:url"         content="https://relay.nixdata.net/u/${key}"/>

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary"/>
  <meta name="twitter:site"        content="@vibeport"/>
  <meta name="twitter:title"       content="${esc(handle)} — Vibeport"/>
  <meta name="twitter:description" content="${esc(bio)}"/>
  <meta name="twitter:image"       content="${ogImg}"/>

  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#000;color:#fff;font-family:monospace;min-height:100vh;
         display:flex;align-items:center;justify-content:center;padding:1.5rem}
    .card{border:1px solid #1a3a1a;background:#050f05;max-width:480px;width:100%;padding:2rem}
    .logo{color:#00ff41;font-size:2rem;font-weight:bold;letter-spacing:.15em;margin-bottom:1.5rem}
    .handle{color:#00ff41;font-size:1.2rem;font-weight:bold;margin-bottom:.4rem}
    .bio{color:#666;font-size:.85rem;line-height:1.5;margin-bottom:1rem}
    .key{color:#1a3a1a;font-size:.6rem;margin-bottom:1.25rem;word-break:break-all}
    .btn{display:block;width:100%;padding:.75rem;text-align:center;font-family:monospace;
         font-size:.85rem;font-weight:bold;text-transform:uppercase;letter-spacing:.1em;
         text-decoration:none;cursor:pointer;border:none;margin-bottom:.5rem}
    .btn-primary{background:#00ff41;color:#000}
    .btn-secondary{background:transparent;border:1px solid #1a3a1a;color:#2a5a2a}
    .tag{color:#1a3a1a;font-size:.6rem;text-transform:uppercase;letter-spacing:.2em;margin-bottom:.75rem}
    .posts-label{color:#1a3a1a;font-size:.6rem;text-transform:uppercase;
                  letter-spacing:.1em;margin:.75rem 0 .25rem}
    .footer{text-align:center;color:#1a3a1a;font-size:.6rem;margin-top:1.5rem;letter-spacing:.2em}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">V</div>
    <div class="tag">Vibeport Node</div>
    <div class="handle">${esc(handle)}</div>
    ${bio ? `<div class="bio">${esc(bio)}</div>` : ''}
    ${postsHTML ? `<div class="posts-label">Recent Vibes</div>${postsHTML}` : ''}
    <div class="key">${esc(short)}</div>
    <a href="${esc(appUrl)}" class="btn btn-primary">+ Add as Friend</a>
    <a href="https://vibeport.nixdata.net" class="btn btn-secondary">What is Vibeport?</a>
  </div>
  <div class="footer">no ads · no algorithm · your data stays with you</div>
</body>
</html>`
  }

  function httpHandler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

    // OG preview page — used as the share link for X, Discord, iMessage etc.
    const previewMatch = req.url.match(/^\/u\/([0-9a-f]{64})$/i)
    if (req.method === 'GET' && previewMatch) {
      const key = previewMatch[1].toLowerCase()
      const cached = profileCache.get(key)
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(buildPreviewHTML(key, cached))
      return
    }

    const profileMatch = req.url.match(/^\/profile\/([0-9a-f]{64})$/i)
    if (req.method === 'GET' && profileMatch) {
      const key    = profileMatch[1].toLowerCase()
      const cached = profileCache.get(key)
      if (!cached) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Profile not cached' }))
        return
      }
      const { expiryTimer, ...data } = cached
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(data))
      return
    }

    // All cached profiles in one shot — used by GuestMode instead of 60 individual fetches
    if (req.method === 'GET' && req.url === '/peers') {
      const list = []
      for (const [key, p] of profileCache) {
        list.push({
          key,
          handle:    p.handle    || '',
          bio:       p.bio       || '',
          posts:     p.posts     || [],
          updatedAt: p.updatedAt || 0,
          isSeed:    !!p.isSeed,
        })
        if (list.length >= 100) break
      }
      // Live (non-seed) profiles first, then seeds
      list.sort((a, b) => (a.isSeed ? 1 : 0) - (b.isSeed ? 1 : 0) || b.updatedAt - a.updatedAt)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(list))
      return
    }

    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, profiles: profileCache.size, spaces: spaces.size }))
      return
    }

    res.writeHead(404); res.end('Not found')
  }

  const httpServer = http.createServer(httpHandler)
  const wss = new WebSocketServer({ server: httpServer })

  // Per-connection event counter for rate limiting
  const counters = new WeakMap()

  setInterval(() => {
    // Reset rate-limit counters every minute
    for (const [ws] of [...subscriptions.values()].flatMap(s => [...s]).map(ws => [ws])) {
      counters.set(ws, 0)
    }
    evictOldFeeds()
  }, 60_000)

  wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress
    counters.set(ws, 0)

    const send = (obj) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj))
    }

    const sendBin = (buf) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(buf)
    }

    ws.on('message', (data, isBinary) => {
      // Rate limit
      const count = (counters.get(ws) ?? 0) + 1
      counters.set(ws, count)
      if (count > rateLimitPerMin) {
        send({ type: 'ERROR', message: 'rate limit exceeded' })
        return
      }

      // ── Binary frame = signed event ────────────────────────────────────────
      if (isBinary) {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)

        if (buf.length < HEADER_BYTES) {
          send({ type: 'ERROR', message: 'event too short' })
          return
        }

        const event = unpackEvent(buf)
        if (!event) {
          send({ type: 'ERROR', message: 'invalid signature' })
          return
        }

        const { pubkeyHex, seq, raw } = event

        storeEvent(pubkeyHex, seq, raw)
        send({ type: 'OK', feedKey: pubkeyHex, seq })

        // Forward to all subscribers of this feed (except sender)
        const subs = subscriptions.get(pubkeyHex)
        if (subs) {
          for (const sub of subs) {
            if (sub !== ws) sendBin.call({ readyState: sub.readyState, send: (d) => sub.send(d) }, raw)
          }
        }
        return
      }

      // ── JSON control message ───────────────────────────────────────────────
      let msg
      try { msg = JSON.parse(data.toString()) }
      catch { send({ type: 'ERROR', message: 'invalid JSON' }); return }

      switch (msg.type) {

        case 'SUBSCRIBE': {
          const key = sanitizeKey(msg.feedKey)
          if (!key) { send({ type: 'ERROR', message: 'invalid feedKey' }); break }

          if (!subscriptions.has(key)) subscriptions.set(key, new Set())
          subscriptions.get(key).add(ws)

          const head = getHead(key)
          send({ type: 'SUBSCRIBED', feedKey: key, head })

          // Replay cached events from fromSeq if requested
          const fromSeq = typeof msg.fromSeq === 'number' ? msg.fromSeq : 0
          if (fromSeq <= head) {
            const cached = getEvents(key, fromSeq)
            for (const { payload } of cached) {
              ws.send(Buffer.from(payload))
            }
          }
          break
        }

        case 'UNSUBSCRIBE': {
          const key = sanitizeKey(msg.feedKey)
          if (key && subscriptions.has(key)) {
            subscriptions.get(key).delete(ws)
            if (subscriptions.get(key).size === 0) subscriptions.delete(key)
          }
          break
        }

        case 'INFO': {
          let totalFeeds = 0
          let totalSubs  = 0
          for (const [, subs] of subscriptions) {
            totalFeeds++
            totalSubs += subs.size
          }
          send({
            type:        'INFO',
            relay:       'vibeport-relay',
            version:     '0.1.0',
            clients:     wss.clients.size,
            feeds:       totalFeeds,
            subscriptions: totalSubs,
          })
          break
        }

        // ── Vibes / Spaces signaling ───────────────────────────────────────

        case 'SPACE_CREATE': {
          const { hostKey, title = 'Untitled Vibe' } = msg
          if (!hostKey) { send({ type: 'ERROR', message: 'hostKey required' }); break }
          const id = hostKey   // one vibe per host
          spaces.set(id, {
            id, hostKey, coHostKey: null,
            title: title.slice(0, 80),
            host: ws,
            speakers:  new Map(),
            listeners: new Map(),
          })
          send({ type: 'SPACE_CREATED', id })
          broadcastSpaceList()
          break
        }

        case 'SPACE_END': {
          const space = spaces.get(msg.id)
          if (space && space.host === ws) {
            broadcastToAll(space, { type: 'SPACE_ENDED', id: msg.id })
            spaces.delete(msg.id)
            broadcastSpaceList()
          }
          break
        }

        case 'SPACE_JOIN': {
          const space = spaces.get(msg.id)
          if (!space) { send({ type: 'ERROR', message: 'Space not found' }); break }
          const { peerKey } = msg
          space.listeners.set(peerKey, ws)
          // Notify ALL stage members so each can send a WebRTC offer
          broadcastToStage(space, { type: 'SPACE_PEER_JOINED', id: msg.id, peerKey })
          send({
            type: 'SPACE_JOINED', id: msg.id,
            hostKey: space.hostKey, coHostKey: space.coHostKey,
            title: space.title, stage: stageKeys(space),
          })
          broadcastSpaceList()
          break
        }

        case 'SPACE_LEAVE': {
          const space = spaces.get(msg.id)
          if (space) {
            space.listeners.delete(msg.peerKey)
            broadcastToStage(space, { type: 'SPACE_PEER_LEFT', id: msg.id, peerKey: msg.peerKey })
            broadcastSpaceList()
          }
          break
        }

        case 'SPACE_REQUEST_SPEAK': {
          // Listener raises hand — notify host + co-host
          const space = spaces.get(msg.id)
          if (!space) break
          spaceSend(space.host, { type: 'SPACE_SPEAK_REQUEST', id: msg.id, peerKey: msg.peerKey })
          if (space.coHostKey) {
            spaceSend(space.speakers.get(space.coHostKey),
              { type: 'SPACE_SPEAK_REQUEST', id: msg.id, peerKey: msg.peerKey })
          }
          break
        }

        case 'SPACE_PROMOTE': {
          // Host or co-host promotes a listener to speaker (or co-host)
          const space = spaces.get(msg.id)
          if (!space) break
          if (msg.fromKey !== space.hostKey && msg.fromKey !== space.coHostKey) break
          if (stageKeys(space).length >= MAX_STAGE) {
            send({ type: 'ERROR', message: 'Stage full (max 10)' }); break
          }
          const peerWs = space.listeners.get(msg.peerKey)
          if (!peerWs) break
          // Move listener → speakers
          space.listeners.delete(msg.peerKey)
          space.speakers.set(msg.peerKey, peerWs)
          if (msg.asCoHost) space.coHostKey = msg.peerKey
          const role = msg.asCoHost ? 'cohost' : 'speaker'
          // Tell new speaker their role + who's already on stage + listeners to offer to
          spaceSend(peerWs, {
            type: 'SPACE_PROMOTED', id: msg.id, role,
            stage:     stageKeys(space).filter(k => k !== msg.peerKey),
            listeners: [...space.listeners.keys()],
          })
          // Tell everyone a new speaker joined stage
          broadcastToAll(space, { type: 'SPACE_SPEAKER_JOINED', id: msg.id, peerKey: msg.peerKey, role })
          broadcastSpaceList()
          break
        }

        case 'SPACE_DEMOTE': {
          // Host demotes a speaker back to listener
          const space = spaces.get(msg.id)
          if (!space || msg.fromKey !== space.hostKey) break
          const peerWs = space.speakers.get(msg.peerKey)
          if (!peerWs) break
          space.speakers.delete(msg.peerKey)
          space.listeners.set(msg.peerKey, peerWs)
          if (space.coHostKey === msg.peerKey) space.coHostKey = null
          spaceSend(peerWs, { type: 'SPACE_DEMOTED', id: msg.id })
          broadcastToAll(space, { type: 'SPACE_SPEAKER_LEFT', id: msg.id, peerKey: msg.peerKey })
          broadcastSpaceList()
          break
        }

        // WebRTC signaling — relay routes offer/answer/ICE between any two participants
        case 'SPACE_OFFER': {
          const space = spaces.get(msg.id)
          if (!space) break
          spaceSend(findWS(space, msg.to),
            { type: 'SPACE_OFFER', id: msg.id, sdp: msg.sdp, from: msg.from })
          break
        }

        case 'SPACE_ANSWER': {
          const space = spaces.get(msg.id)
          if (!space) break
          spaceSend(findWS(space, msg.to),
            { type: 'SPACE_ANSWER', id: msg.id, sdp: msg.sdp, from: msg.from })
          break
        }

        case 'SPACE_ICE': {
          const space = spaces.get(msg.id)
          if (!space) break
          spaceSend(findWS(space, msg.to),
            { type: 'SPACE_ICE', id: msg.id, candidate: msg.candidate, from: msg.from })
          break
        }

        case 'SPACES_LIST': {
          const list = [...spaces.values()].map(s => ({
            id: s.id, hostKey: s.hostKey, title: s.title, listeners: s.listeners.size,
          }))
          send({ type: 'SPACES_LIST', spaces: list })
          break
        }

        // ── Direct Messages (BitChat-style E2E encrypted) ──────────────────
        case 'DM': {
          const { to, from, nonce, ciphertext, sig } = msg
          if (!to || !from || !nonce || !ciphertext || !sig) break
          if (!/^[0-9a-f]{64}$/i.test(to) || !/^[0-9a-f]{64}$/i.test(from)) break

          // Forward to recipient if online (subscribed to their own feed key)
          const recipientSubs = subscriptions.get(to.toLowerCase())
          if (recipientSubs?.size) {
            const payload = JSON.stringify({ type: 'DM', to, from, nonce, ciphertext, sig })
            for (const subWs of recipientSubs) {
              if (subWs !== ws && subWs.readyState === WebSocket.OPEN) subWs.send(payload)
            }
          }
          send({ type: 'DM_OK' })
          break
        }

        // ── Peer discovery ─────────────────────────────────────────────────
        case 'PEER_LIST': {
          const seen  = new Set()
          const peers = []
          // Live subscribers first (real nodes currently connected)
          for (const [key] of subscriptions) {
            if (/^[0-9a-f]{64}$/.test(key) && !seen.has(key)) {
              seen.add(key); peers.push(key)
              if (peers.length >= 100) break
            }
          }
          // Fill remaining slots with seed profiles (always discoverable)
          if (peers.length < 100) {
            for (const [key, profile] of profileCache) {
              if (profile.isSeed && !seen.has(key)) {
                seen.add(key); peers.push(key)
                if (peers.length >= 100) break
              }
            }
          }
          send({ type: 'PEER_LIST', peers })
          break
        }

        // ── Profile cache (for 24h offline buffer) ──────────────────────────
        case 'PROFILE_PUBLISH': {
          const { nodeKey, handle, bio, custom_css, avatar, posts } = msg
          if (!nodeKey || !/^[0-9a-f]{64}$/i.test(nodeKey)) break

          // Cancel any pending expiry timer
          const existing = profileCache.get(nodeKey.toLowerCase())
          if (existing?.expiryTimer) clearTimeout(existing.expiryTimer)

          profileCache.set(nodeKey.toLowerCase(), {
            handle:     String(handle     ?? '').slice(0, 64),
            bio:        String(bio        ?? '').slice(0, 500),
            custom_css: String(custom_css ?? '').slice(0, 8000),
            avatar:     avatar ?? null,
            posts:      Array.isArray(posts) ? posts.slice(0, 10) : [],
            updatedAt:  Date.now(),
            expiryTimer: null,
          })

          // Associate this ws with this key so we can expire on disconnect
          wsToProfileKey.set(ws, nodeKey.toLowerCase())
          break
        }

        default:
          send({ type: 'ERROR', message: `unknown message type: ${msg.type}` })
      }
    })

    ws.on('close', () => {
      // Start 24h profile expiry if this ws published a profile (seeds never expire)
      const profileKey = wsToProfileKey.get(ws)
      if (profileKey) {
        const cached = profileCache.get(profileKey)
        if (cached && !cached.isSeed) {
          if (cached.expiryTimer) clearTimeout(cached.expiryTimer)
          cached.expiryTimer = setTimeout(() => profileCache.delete(profileKey), PROFILE_TTL_MS)
        }
      }

      // Clean up subscriptions
      for (const [key, subs] of subscriptions) {
        subs.delete(ws)
        if (subs.size === 0) subscriptions.delete(key)
      }
      // Clean up any space this socket was part of
      for (const [id, space] of spaces) {
        if (space.host === ws) {
          // Host left — end the whole space
          broadcastToAll(space, { type: 'SPACE_ENDED', id })
          spaces.delete(id)
          broadcastSpaceList()
        } else {
          // Check if they were a speaker
          for (const [peerKey, sws] of space.speakers) {
            if (sws === ws) {
              space.speakers.delete(peerKey)
              if (space.coHostKey === peerKey) space.coHostKey = null
              broadcastToAll(space, { type: 'SPACE_SPEAKER_LEFT', id, peerKey })
              broadcastSpaceList()
              break
            }
          }
          // Check if they were a listener
          for (const [peerKey, lws] of space.listeners) {
            if (lws === ws) {
              space.listeners.delete(peerKey)
              broadcastToStage(space, { type: 'SPACE_PEER_LEFT', id, peerKey })
              broadcastSpaceList()
              break
            }
          }
        }
      }
    })

    ws.on('error', () => ws.terminate())
  })

  wss.on('error', (err) => console.error('[relay] Server error:', err.message))

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`[relay] HTTP + WebSocket listening on port ${port}`)
  })

  return { wss, httpServer }
}

function sanitizeKey(k) {
  if (typeof k !== 'string') return null
  if (!/^[0-9a-f]{64}$/i.test(k)) return null
  return k.toLowerCase()
}
