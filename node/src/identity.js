/**
 * identity.js
 * Generates and persists an Ed25519 keypair for this node.
 * The public key is your "address" on the network — shareable.
 * The secret key never leaves this device.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sodium from 'sodium-native'
import z32 from 'z32'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(__dirname, '../../data')
const IDENTITY_FILE = path.join(DATA_DIR, 'identity.json')

export function loadOrCreateIdentity() {
  fs.mkdirSync(DATA_DIR, { recursive: true })

  if (fs.existsSync(IDENTITY_FILE)) {
    const raw = JSON.parse(fs.readFileSync(IDENTITY_FILE, 'utf8'))
    return {
      publicKey: Buffer.from(raw.publicKey, 'hex'),
      secretKey: Buffer.from(raw.secretKey, 'hex'),
      address: raw.address,
    }
  }

  // Generate a new Ed25519 keypair
  const publicKey = sodium.sodium_malloc(sodium.crypto_sign_PUBLICKEYBYTES)
  const secretKey = sodium.sodium_malloc(sodium.crypto_sign_SECRETKEYBYTES)
  sodium.crypto_sign_keypair(publicKey, secretKey)

  const address = z32.encode(publicKey) // human-readable base32 address

  const identity = {
    publicKey: publicKey.toString('hex'),
    secretKey: secretKey.toString('hex'),
    address,
  }

  fs.writeFileSync(IDENTITY_FILE, JSON.stringify(identity, null, 2), {
    mode: 0o600, // owner-read only
  })

  console.log(`[identity] New identity created: ${address}`)
  return { publicKey, secretKey, address }
}
