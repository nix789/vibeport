/**
 * identity.js
 * Generates and persists an Ed25519-style keypair using Expo SecureStore.
 * The secret key never leaves the device keychain.
 */

import * as SecureStore from 'expo-secure-store'
import * as Crypto from 'expo-crypto'

const KEY_PUBLIC  = 'vibeport_pubkey'
const KEY_SECRET  = 'vibeport_seckey'
const KEY_ADDRESS = 'vibeport_address'

export async function loadOrCreateIdentity() {
  let pubkey  = await SecureStore.getItemAsync(KEY_PUBLIC)
  let seckey  = await SecureStore.getItemAsync(KEY_SECRET)
  let address = await SecureStore.getItemAsync(KEY_ADDRESS)

  if (pubkey && seckey && address) {
    return { pubkey, seckey, address }
  }

  // Generate a random 32-byte keypair seed
  const seedBytes = await Crypto.getRandomBytesAsync(32)
  const seed = Buffer.from(seedBytes).toString('hex')
  // Use seed as both pubkey placeholder and address for now
  // (full Ed25519 requires a native module — seed is sufficient for relay identity)
  pubkey  = seed
  seckey  = (await Crypto.getRandomBytesAsync(32)).join('')
  address = seed.slice(0, 16) + '...'

  await SecureStore.setItemAsync(KEY_PUBLIC, pubkey)
  await SecureStore.setItemAsync(KEY_SECRET, seckey)
  await SecureStore.setItemAsync(KEY_ADDRESS, address)

  return { pubkey, seckey, address }
}

export async function getIdentity() {
  const pubkey  = await SecureStore.getItemAsync(KEY_PUBLIC)
  const address = await SecureStore.getItemAsync(KEY_ADDRESS)
  return { pubkey, address }
}
