/**
 * index.js
 * Entry point. Boots identity, database, P2P node, and local API.
 */

import { loadOrCreateIdentity } from './identity.js'
import { openDB, getDB } from './store.js'
import { initP2P } from './p2p.js'
import { startAPI } from './api.js'
import { startMediaCleanup } from './media.js'
import { initRelayClient } from './relay-client.js'
import { addFriend } from './p2p.js'

// Admin node — auto-friended on every new install
const ADMIN_CORE_KEY = '19b512a50e0668bfd843b5ac16dab2902c0709f2fcd8426719a50fe9161a4a55'

async function main() {
  console.log('=== Vibeport Node Starting ===')

  const identity = loadOrCreateIdentity()
  console.log(`[identity] Address: ${identity.address}`)

  openDB()
  console.log('[db] SQLite ready')

  await initP2P(identity)
  console.log('[p2p] Hyperswarm ready')

  // Auto-friend admin on new installs (skip if this is the admin node itself)
  if (identity._new && identity.publicKey.toString('hex') !== ADMIN_CORE_KEY) {
    try {
      await addFriend(ADMIN_CORE_KEY)
      getDB().prepare(`UPDATE friends SET handle = 'Vibeport' WHERE address = ?`).run(ADMIN_CORE_KEY)
      console.log('[admin] Auto-friended Vibeport admin node')
    } catch (e) {
      console.warn('[admin] Could not auto-friend admin:', e.message)
    }
  }

  initRelayClient(identity)
  console.log('[relay-client] Relay connections initializing')

  startAPI()
  startMediaCleanup()
  console.log('[media] 72h expiry cleanup scheduled')

  process.on('SIGINT', async () => {
    console.log('\n[node] Shutting down...')
    const { shutdownP2P } = await import('./p2p.js')
    await shutdownP2P()
    process.exit(0)
  })
}

main().catch(err => {
  console.error('[fatal]', err)
  process.exit(1)
})
