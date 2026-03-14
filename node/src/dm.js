/**
 * dm.js
 * BitChat-style end-to-end encrypted direct messages.
 *
 * Protocol (mirrors BitChat Android):
 *   - X25519 key exchange   (Ed25519 keypair converted via sodium)
 *   - crypto_box_easy       (XSalsa20-Poly1305) for encryption
 *   - Ed25519 signature     for sender authentication (non-repudiation)
 *
 * Wire format (relay DM message):
 *   {
 *     type:       'DM',
 *     to:         recipientEd25519PubkeyHex,
 *     from:       senderEd25519PubkeyHex,
 *     nonce:      24-byte nonce hex,
 *     ciphertext: encrypted content hex,
 *     sig:        Ed25519 signature of (nonce||ciphertext) hex,
 *   }
 */

import sodium from 'sodium-native'

// ── Key conversion ────────────────────────────────────────────────────────────

/** Convert an Ed25519 public key (32 bytes) to Curve25519 / X25519. */
function ed25519PkToCurve25519(edPkHex) {
  const edPk   = Buffer.from(edPkHex, 'hex')
  const curvePk = Buffer.alloc(sodium.crypto_box_PUBLICKEYBYTES)
  sodium.crypto_sign_ed25519_pk_to_curve25519(curvePk, edPk)
  return curvePk
}

/** Convert an Ed25519 secret key (64 bytes) to Curve25519 / X25519. */
function ed25519SkToCurve25519(edSkHex) {
  const edSk   = Buffer.from(edSkHex, 'hex')
  const curveSk = Buffer.alloc(sodium.crypto_box_SECRETKEYBYTES)
  sodium.crypto_sign_ed25519_sk_to_curve25519(curveSk, edSk)
  return curveSk
}

// ── Encrypt ───────────────────────────────────────────────────────────────────

/**
 * Encrypt a plaintext string for a recipient.
 *
 * @param {string} plaintext - The message content
 * @param {string} recipientEdPkHex - Recipient's Ed25519 public key (64 hex chars)
 * @param {{ publicKey: string, secretKey: string }} identity - Our own keypair
 * @returns {{ nonce: string, ciphertext: string, sig: string }}
 */
export function encryptDM(plaintext, recipientEdPkHex, identity) {
  const msg      = Buffer.from(plaintext, 'utf8')
  const nonce    = Buffer.alloc(sodium.crypto_box_NONCEBYTES)
  sodium.randombytes_buf(nonce)

  const recipientCurvePk = ed25519PkToCurve25519(recipientEdPkHex)
  const myCurveSk        = ed25519SkToCurve25519(identity.secretKey)

  const ciphertext = Buffer.alloc(msg.length + sodium.crypto_box_MACBYTES)
  sodium.crypto_box_easy(ciphertext, msg, nonce, recipientCurvePk, myCurveSk)

  // Sign (nonce || ciphertext) so recipient can verify sender
  const sigPayload = Buffer.concat([nonce, ciphertext])
  const sig        = Buffer.alloc(sodium.crypto_sign_BYTES)
  const edSk       = Buffer.from(identity.secretKey, 'hex')
  sodium.crypto_sign_detached(sig, sigPayload, edSk)

  return {
    nonce:      nonce.toString('hex'),
    ciphertext: ciphertext.toString('hex'),
    sig:        sig.toString('hex'),
  }
}

// ── Decrypt ───────────────────────────────────────────────────────────────────

/**
 * Decrypt an incoming DM.
 *
 * @param {{ nonce, ciphertext, sig, from }} dmMsg - Wire format fields
 * @param {{ publicKey: string, secretKey: string }} identity - Our own keypair
 * @returns {string|null} - Decrypted plaintext, or null on failure
 */
export function decryptDM(dmMsg, identity) {
  try {
    const nonce      = Buffer.from(dmMsg.nonce,      'hex')
    const ciphertext = Buffer.from(dmMsg.ciphertext, 'hex')
    const sig        = Buffer.from(dmMsg.sig,        'hex')
    const senderEdPk = Buffer.from(dmMsg.from,       'hex')

    // Verify Ed25519 signature
    const sigPayload = Buffer.concat([nonce, ciphertext])
    if (!sodium.crypto_sign_verify_detached(sig, sigPayload, senderEdPk)) {
      console.warn('[dm] Invalid signature from', dmMsg.from.slice(0, 16))
      return null
    }

    const senderCurvePk = ed25519PkToCurve25519(dmMsg.from)
    const myCurveSk     = ed25519SkToCurve25519(identity.secretKey)

    const plaintext = Buffer.alloc(ciphertext.length - sodium.crypto_box_MACBYTES)
    const ok = sodium.crypto_box_open_easy(plaintext, ciphertext, nonce, senderCurvePk, myCurveSk)
    if (!ok) return null

    return plaintext.toString('utf8')
  } catch (e) {
    console.warn('[dm] Decrypt error:', e.message)
    return null
  }
}
