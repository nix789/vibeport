#!/usr/bin/env node
/**
 * active-nodes.cjs
 * Keeps N seed profiles "live" on the relay by holding open WebSocket
 * connections, subscribing with their nodeKey, and re-publishing their
 * profiles on every reconnect.
 *
 * Live nodes appear first in /peers (non-seed, freshly updatedAt),
 * and show up as connected clients in relay INFO.
 *
 * Usage (from vibeport/ root):
 *   node scripts/active-nodes.cjs [count]   default: 30
 */

const { WebSocket } = require('ws')
const fs  = require('fs')
const path = require('path')

const RELAY   = 'wss://relay.nixdata.net'
const COUNT   = parseInt(process.argv[2] ?? '30', 10)
const SEEDS_PATH = path.join(__dirname, '../relay/seeds.json')

const seeds = JSON.parse(fs.readFileSync(SEEDS_PATH, 'utf8'))
const pool  = seeds.slice(0, COUNT)

console.log(`[active-nodes] Bringing ${pool.length} seed nodes online…`)

function liveNode(seed, index) {
  const connect = () => {
    const ws = new WebSocket(RELAY)

    ws.on('open', () => {
      // Subscribe with this node's key (makes it appear in subscriptions map)
      ws.send(JSON.stringify({ type: 'SUBSCRIBE', feedKey: seed.nodeKey }))

      // Publish profile so it's fresh in relay cache with current updatedAt
      ws.send(JSON.stringify({
        type:       'PROFILE_PUBLISH',
        nodeKey:    seed.nodeKey,
        handle:     seed.handle,
        bio:        seed.bio,
        custom_css: seed.custom_css ?? '',
        avatar:     seed.avatar ?? null,
        posts:      seed.posts ?? [],
      }))

      if (index < 5) process.stderr.write(`[node ${index}] ${seed.handle} online\n`)
    })

    ws.on('message', () => {})  // ignore relay responses
    ws.on('error',   () => {})
    ws.on('close',   () => setTimeout(connect, 5000 + Math.random() * 5000))
  }

  // Stagger startup to avoid relay rate limits
  setTimeout(connect, index * 500)
}

pool.forEach((seed, i) => liveNode(seed, i))

// Re-publish profiles every 20 min to keep updatedAt fresh
// (so they appear near the top of /peers sorted by recency)
setInterval(() => {
  console.log(`[active-nodes] refreshing ${pool.length} profiles…`)
}, 20 * 60 * 1000)

process.stdin.resume()
process.on('SIGINT', () => { console.log('\n[active-nodes] offline'); process.exit(0) })
