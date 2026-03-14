/**
 * Vibeport Relay — entry point.
 *
 * Environment variables:
 *   PORT              WebSocket port (default 4444)
 *   RATE_LIMIT        Max messages per client per minute (default 300)
 *   RELAY_OPERATORS   Comma-separated pubkey hex of operators (for INFO metadata)
 */

import { openDB } from './db.js'
import { startServer } from './server.js'

const PORT       = parseInt(process.env.PORT ?? '4444', 10)
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT ?? '300', 10)

console.log('=== Vibeport Relay Starting ===')
openDB()
console.log('[db] SQLite ready')

const wss = startServer(PORT, RATE_LIMIT)
console.log(`[relay] Address: ws://0.0.0.0:${PORT}`)
console.log(`[relay] Clients connect via: wss://<your-domain>:${PORT}`)

process.on('SIGINT', () => {
  console.log('\n[relay] Shutting down...')
  wss.close(() => process.exit(0))
})
