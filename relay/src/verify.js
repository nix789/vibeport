/**
 * verify.js
 * Ed25519 signature verification for relay events.
 *
 * Wire format of every event the client sends:
 *   [64 bytes signature][32 bytes pubkey][4 bytes seq BE][N bytes payload]
 *
 * The relay verifies the signature before storing or forwarding.
 * A relay that skips this check is useless — it would cache spam.
 */

import sodium from 'sodium-native'

const SIG_BYTES    = sodium.crypto_sign_BYTES            // 64
const PUBKEY_BYTES = sodium.crypto_sign_PUBLICKEYBYTES   // 32
const SEQ_BYTES    = 4
export const HEADER_BYTES = SIG_BYTES + PUBKEY_BYTES + SEQ_BYTES  // 100

/**
 * Verify and unpack an event buffer.
 * Returns { pubkeyHex, seq, body } or null if invalid.
 */
export function unpackEvent(buf) {
  if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf)
  if (buf.length < HEADER_BYTES) return null

  const sig    = buf.subarray(0, SIG_BYTES)
  const pubkey = buf.subarray(SIG_BYTES, SIG_BYTES + PUBKEY_BYTES)
  // The signed message = pubkey + seq_bytes + body
  const signed = buf.subarray(SIG_BYTES)

  const valid = sodium.crypto_sign_verify_detached(sig, signed, pubkey)
  if (!valid) return null

  const seq  = signed.readUInt32BE(PUBKEY_BYTES)
  const body = signed.subarray(PUBKEY_BYTES + SEQ_BYTES)

  return {
    pubkeyHex: pubkey.toString('hex'),
    seq,
    body,
    raw: buf,  // original buffer for forwarding
  }
}

/**
 * Build a signed event buffer (used by the LOCAL NODE, not the relay).
 * Exported here so node/src/relay-client.js can use the same format.
 */
export function packEvent(secretKey, pubkey, seq, body) {
  const seqBuf = Buffer.alloc(4)
  seqBuf.writeUInt32BE(seq, 0)

  const message = Buffer.concat([pubkey, seqBuf, body])
  const sig     = Buffer.allocUnsafe(SIG_BYTES)
  sodium.crypto_sign_detached(sig, message, secretKey)

  return Buffer.concat([sig, message])
}
