/**
 * index.js
 * Entry point. Boots identity, database, P2P node, and local API.
 */

import { loadOrCreateIdentity } from './identity.js'
import { openDB } from './store.js'
import { initP2P } from './p2p.js'
import { startAPI } from './api.js'
import { startMediaCleanup } from './media.js'
import { initRelayClient } from './relay-client.js'

async function main() {
  console.log('=== Vibeport Node Starting ===')

  const identity = loadOrCreateIdentity()
  console.log(`[identity] Address: ${identity.address}`)

  openDB()
  console.log('[db] SQLite ready')

  await initP2P(identity)
  console.log('[p2p] Hyperswarm ready')

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
