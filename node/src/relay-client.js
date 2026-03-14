/**
 * relay-client.js
 * Connects the local Vibeport node to one or more relay servers.
 *
 * Responsibilities:
 *   - Publish every new local Hypercore event to all relays (signed)
 *   - Subscribe to friend feed keys via relays (for offline delivery)
 *   - Reconnect automatically with exponential backoff
 */

import { WebSocket } from 'ws'
import { getDB } from './store.js'
import sodium from 'sodium-native'

const RECONNECT_BASE_MS = 2000
const RECONNECT_MAX_MS  = 60_000
const SIG_BYTES    = sodium.crypto_sign_BYTES
const PUBKEY_BYTES = sodium.crypto_sign_PUBLICKEYBYTES

// Default relays — users can add more via the API
export const DEFAULT_RELAYS = [
  'wss://relay.nixdata.net:4444',
]

const activeRelays = new Map()  // url → { ws, backoff, timer }

let _identity = null

export function initRelayClient(identity) {
  _identity = identity
  const db = getDB()

  // Load saved relay list
  const saved = db.prepare('SELECT url FROM relays WHERE enabled = 1').all()
  for (const { url } of saved) connectRelay(url)

  // If no saved relays, connect to defaults
  if (saved.length === 0) {
    for (const url of DEFAULT_RELAYS) connectRelay(url)
  }
}

export function connectRelay(url) {
  if (activeRelays.has(url)) return
  activeRelays.set(url, { ws: null, backoff: RECONNECT_BASE_MS, timer: null })
  _connect(url)
}

export function disconnectRelay(url) {
  const entry = activeRelays.get(url)
  if (!entry) return
  clearTimeout(entry.timer)
  entry.ws?.close()
  activeRelays.delete(url)
}

export function getRelayStatus() {
  return [...activeRelays.entries()].map(([url, entry]) => ({
    url,
    connected: entry.ws?.readyState === WebSocket.OPEN,
  }))
}

/** Publish a signed event buffer to all connected relays */
export function publishToRelays(seq, bodyObj) {
  if (!_identity) return
  const buf = _buildEvent(seq, bodyObj)
  for (const [, entry] of activeRelays) {
    if (entry.ws?.readyState === WebSocket.OPEN) {
      entry.ws.send(buf)
    }
  }
}

/** Subscribe to a friend's feed on all relays, from a given seq */
export function subscribeOnRelays(feedKey, fromSeq = 0) {
  for (const [, entry] of activeRelays) {
    if (entry.ws?.readyState === WebSocket.OPEN) {
      entry.ws.send(JSON.stringify({ type: 'SUBSCRIBE', feedKey, fromSeq }))
    }
  }
}

// ── Internal ─────────────────────────────────────────────────────────────────

function _connect(url) {
  const entry = activeRelays.get(url)
  if (!entry) return

  console.log(`[relay-client] Connecting to ${url}`)
  let ws
  try {
    ws = new WebSocket(url)
  } catch (err) {
    console.error(`[relay-client] Bad URL ${url}:`, err.message)
    return
  }

  entry.ws = ws

  ws.on('open', () => {
    console.log(`[relay-client] Connected: ${url}`)
    entry.backoff = RECONNECT_BASE_MS  // reset backoff

    // Re-subscribe to all friends' feeds
    if (_identity) {
      const db = getDB()
      const friends = db.prepare('SELECT address FROM friends').all()
      for (const { address } of friends) {
        ws.send(JSON.stringify({ type: 'SUBSCRIBE', feedKey: address, fromSeq: 0 }))
      }
    }
  })

  ws.on('message', (data, isBinary) => {
    if (isBinary) {
      // Incoming event from a friend's feed — store it locally
      _handleIncomingEvent(Buffer.isBuffer(data) ? data : Buffer.from(data))
      return
    }
    try {
      const msg = JSON.parse(data.toString())
      if (msg.type === 'ERROR') {
        console.warn(`[relay-client] Relay error from ${url}:`, msg.message)
      }
    } catch {}
  })

  ws.on('close', () => {
    console.log(`[relay-client] Disconnected from ${url} — retrying in ${entry.backoff}ms`)
    entry.timer = setTimeout(() => {
      entry.backoff = Math.min(entry.backoff * 2, RECONNECT_MAX_MS)
      _connect(url)
    }, entry.backoff)
  })

  ws.on('error', (err) => {
    console.error(`[relay-client] ${url}:`, err.message)
  })
}

function _buildEvent(seq, bodyObj) {
  const { publicKey, secretKey } = _identity
  const body   = Buffer.from(JSON.stringify(bodyObj))
  const seqBuf = Buffer.alloc(4)
  seqBuf.writeUInt32BE(seq, 0)

  const message = Buffer.concat([Buffer.from(publicKey), seqBuf, body])
  const sig     = Buffer.allocUnsafe(SIG_BYTES)
  sodium.crypto_sign_detached(sig, message, Buffer.from(secretKey))

  return Buffer.concat([sig, message])
}

function _handleIncomingEvent(buf) {
  // Minimal parse — just extract pubkey and cache in friend_profiles
  // Full verification is done by verify.js; here we just persist the raw bytes
  if (buf.length < SIG_BYTES + PUBKEY_BYTES + 4) return
  const pubkey = buf.subarray(SIG_BYTES, SIG_BYTES + PUBKEY_BYTES)
  const feedKey = pubkey.toString('hex')
  const body = buf.subarray(SIG_BYTES + PUBKEY_BYTES + 4)

  let event
  try { event = JSON.parse(body.toString()) } catch { return }

  if (event.type === 'profile_update') {
    const db = getDB()
    const p  = event.payload ?? {}
    db.prepare(`
      INSERT INTO friend_profiles (address, handle, bio, song_url, custom_css, custom_html, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, unixepoch())
      ON CONFLICT(address) DO UPDATE SET
        handle      = excluded.handle,
        bio         = excluded.bio,
        song_url    = excluded.song_url,
        custom_css  = excluded.custom_css,
        custom_html = excluded.custom_html,
        synced_at   = excluded.synced_at
    `).run(feedKey, p.handle ?? '', p.bio ?? '', p.song_url ?? '', p.custom_css ?? '', p.custom_html ?? '')
  }
}
