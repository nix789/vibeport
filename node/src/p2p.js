/**
 * p2p.js
 * Hyperswarm DHT-based peer discovery and Hypercore replication.
 * Each user has an append-only Hypercore log that syncs to friends.
 */

import Hyperswarm from 'hyperswarm'
import Corestore from 'corestore'
import path from 'path'
import { fileURLToPath } from 'url'
import { getDB } from './store.js'
import crypto from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STORE_PATH = path.resolve(__dirname, '../../data/hypercore')

let swarm
let store
let localCore

/**
 * Initialize Hypercore store and Hyperswarm DHT.
 * @param {Buffer} publicKey - Our identity public key
 */
export async function initP2P(identity) {
  store = new Corestore(STORE_PATH)
  await store.ready()

  // Our personal append-only log — keyed to our identity
  localCore = store.get({ name: 'profile-log' })
  await localCore.ready()

  swarm = new Hyperswarm()

  // Announce ourselves on our core's discovery key
  const discovery = swarm.join(localCore.discoveryKey, { server: true, client: true })
  await discovery.flushed()

  swarm.on('connection', (conn, info) => {
    console.log(`[p2p] Peer connected: ${info.publicKey.toString('hex').slice(0, 16)}...`)
    store.replicate(conn)
  })

  console.log(`[p2p] Node online. Core key: ${localCore.key.toString('hex')}`)
  return { swarm, store, localCore }
}

/**
 * Append a profile update event to our local Hypercore log.
 * Peers syncing our core will see this automatically.
 */
export async function appendEvent(type, payload) {
  const entry = JSON.stringify({ type, payload, ts: Date.now() })
  await localCore.append(Buffer.from(entry))
}

/**
 * Add a friend by their Hypercore key (hex string).
 * Joins the DHT topic for their core and starts syncing.
 */
export async function addFriend(coreKeyHex) {
  const db = getDB()
  const coreKey = Buffer.from(coreKeyHex, 'hex')

  // Get or create a replicated copy of their core
  const friendCore = store.get({ key: coreKey })
  await friendCore.ready()

  // Join the DHT topic for their core
  swarm.join(friendCore.discoveryKey, { server: false, client: true })

  // Read all their events once synced
  friendCore.on('append', () => syncFriendCore(friendCore, coreKeyHex))

  db.prepare(`
    INSERT OR IGNORE INTO friends (address) VALUES (?)
  `).run(coreKeyHex)

  console.log(`[p2p] Now following: ${coreKeyHex.slice(0, 16)}...`)
  return friendCore
}

/**
 * Read all events from a friend's Hypercore and update local cache.
 */
async function syncFriendCore(core, address) {
  const db = getDB()
  const length = core.length

  for (let i = 0; i < length; i++) {
    const block = await core.get(i)
    let event
    try {
      event = JSON.parse(block.toString())
    } catch {
      continue
    }

    if (event.type === 'profile_update') {
      const p = event.payload
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
      `).run(address, p.handle ?? '', p.bio ?? '', p.song_url ?? '', p.custom_css ?? '', p.custom_html ?? '')
    }
  }
}

export function getLocalCoreKey() {
  return localCore?.key?.toString('hex')
}

export async function shutdownP2P() {
  await swarm?.destroy()
  await store?.close()
}
