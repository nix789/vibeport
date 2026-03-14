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

import { WebSocketServer, WebSocket } from 'ws'
import { storeEvent, getEvents, getHead, evictOldFeeds } from './db.js'
import { unpackEvent, HEADER_BYTES } from './verify.js'

// feedKey → Set<WebSocket>
const subscriptions = new Map()

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
  const wss = new WebSocketServer({ port })

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
          const peers = []
          for (const [key] of subscriptions) {
            if (/^[0-9a-f]{64}$/.test(key)) peers.push(key)
            if (peers.length >= 100) break
          }
          send({ type: 'PEER_LIST', peers })
          break
        }

        default:
          send({ type: 'ERROR', message: `unknown message type: ${msg.type}` })
      }
    })

    ws.on('close', () => {
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

  console.log(`[relay] WebSocket relay listening on ws://0.0.0.0:${port}`)
  return wss
}

function sanitizeKey(k) {
  if (typeof k !== 'string') return null
  if (!/^[0-9a-f]{64}$/i.test(k)) return null
  return k.toLowerCase()
}
