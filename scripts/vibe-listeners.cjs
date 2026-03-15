#!/usr/bin/env node
/**
 * vibe-listeners.cjs
 * Noise listeners for a live Vibe. Dynamically discovers active spaces
 * and auto-joins/rejoins them. Runs until Ctrl+C.
 *
 * Usage: node scripts/vibe-listeners.cjs [count]
 */

const { WebSocket } = require('ws')
const { randomBytes } = require('crypto')

const RELAY = 'wss://relay.nixdata.net'
const COUNT = parseInt(process.argv[2] ?? '20', 10)

let currentSpace = null  // { id, title }

// ── Space watcher — maintains one WS, keeps currentSpace up to date ──────────
function watchSpaces() {
  const ws = new WebSocket(RELAY)
  ws.on('open', () => {
    ws.send(JSON.stringify({ type: 'SPACES_LIST' }))
    ws.send(JSON.stringify({ type: 'SUBSCRIBE', feedKey: 'spaces' }))
  })
  ws.on('message', data => {
    try {
      const msg = JSON.parse(data.toString())
      if (msg.type === 'SPACES_LIST') {
        const space = msg.spaces?.[0] ?? null
        if (space && (!currentSpace || currentSpace.id !== space.id)) {
          currentSpace = space
          console.log(`[watcher] Space found: "${space.title}" (${space.id.slice(0,16)}…)`)
        } else if (!space && currentSpace) {
          console.log('[watcher] Space ended — waiting for new one…')
          currentSpace = null
        }
      }
    } catch {}
  })
  ws.on('close', () => setTimeout(watchSpaces, 3000))
  ws.on('error', () => {})
}

// ── Individual bot ────────────────────────────────────────────────────────────
function spawnBot(index) {
  const peerKey = randomBytes(32).toString('hex')
  let joined = null  // space id currently joined

  function connect() {
    const ws = new WebSocket(RELAY)

    ws.on('open', () => {
      // Wait briefly for space to be known, then join
      const tryJoin = () => {
        if (!currentSpace) { setTimeout(tryJoin, 1000); return }
        if (joined === currentSpace.id) return
        joined = currentSpace.id
        ws.send(JSON.stringify({ type: 'SPACE_JOIN', id: joined, peerKey }))
      }
      setTimeout(tryJoin, 500 + index * 200)
    })

    ws.on('message', data => {
      try {
        const msg = JSON.parse(data.toString())
        if (msg.type === 'SPACE_JOINED') {
          process.stderr.write(`[bot ${String(index).padStart(2)}] joined "${msg.title}"\n`)
        }
        if (msg.type === 'SPACE_ENDED') {
          joined = null
          // Space ended — relay will close our slot; reconnect to watch for next one
        }
        // Ignore SPACE_OFFER — bots are silent slots, not real WebRTC peers
      } catch {}
    })

    ws.on('close', () => {
      joined = null
      setTimeout(connect, 4000 + Math.random() * 3000)
    })
    ws.on('error', () => {})
  }

  // Stagger start so we don't slam the relay
  setTimeout(connect, 1000 + index * 350)
}

// ── Main ─────────────────────────────────────────────────────────────────────
console.log(`[bots] Starting ${COUNT} listener bots — watching for live spaces…`)
watchSpaces()
for (let i = 0; i < COUNT; i++) spawnBot(i)

// Periodically log status
setInterval(() => {
  if (currentSpace) {
    console.log(`[bots] ${COUNT} bots targeting "${currentSpace.title}"`)
  } else {
    console.log('[bots] waiting for a space to go live…')
  }
}, 30_000)

process.stdin.resume()
process.on('SIGINT', () => { console.log('\n[bots] bye'); process.exit(0) })
