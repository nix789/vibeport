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

        default:
          send({ type: 'ERROR', message: `unknown message type: ${msg.type}` })
      }
    })

    ws.on('close', () => {
      // Clean up all subscriptions for this socket
      for (const [key, subs] of subscriptions) {
        subs.delete(ws)
        if (subs.size === 0) subscriptions.delete(key)
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
