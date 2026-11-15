/**
 * src/lib/server/encryption.ts
 * Server-only credential encryption/decryption
 * Uses AES-256-GCM with authenticated encryption
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'

const algorithm = 'aes-256-gcm'

function getEncryptionConfig() {
  const masterKeyHex = process.env.ENCRYPTION_MASTER_KEY
  if (!masterKeyHex) {
    throw new Error('ENCRYPTION_MASTER_KEY is not configured')
  }

  // Validate that the master key is a 32-byte hex string (256-bit)
  if (!/^[0-9a-f]{64}$/.test(masterKeyHex)) {
    throw new Error(
      'ENCRYPTION_MASTER_KEY must be a 64-character hex string (256-bit key). Generate with: openssl rand -hex 32'
    )
  }

  const masterKey = Buffer.from(masterKeyHex, 'hex')
  const keyVersion = process.env.ENCRYPTION_KEY_VERSION || '1'

  return { masterKey, keyVersion }
}

export interface EncryptedCredential {
  encrypted: string // Base64 encoded ciphertext
  nonce: string // Base64 encoded nonce
  tag: string // Base64 encoded authentication tag
  version: string // Key version for rotation support
}

/**
 * Encrypt a credential using AES-256-GCM
 * @param plaintext The credential to encrypt (e.g., API key)
 * @returns Encrypted credential with all required metadata
 */
export function encryptCredential(plaintext: string): EncryptedCredential {
  const { masterKey, keyVersion } = getEncryptionConfig()

  // Generate a random nonce (12 bytes for GCM)
  const nonce = randomBytes(12)

  // Create cipher
  const cipher = createCipheriv(algorithm, masterKey, nonce)

  // Encrypt the plaintext
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  // Get authentication tag
  const tag = cipher.getAuthTag()

  return {
    encrypted: Buffer.from(encrypted, 'hex').toString('base64'),
    nonce: nonce.toString('base64'),
    tag: tag.toString('base64'),
    version: keyVersion,
  }
}

/**
 * Decrypt a credential using AES-256-GCM
 * @param encryptedCredential The encrypted credential object
 * @returns The decrypted plaintext
 * @throws Error if decryption fails (authentication failed or corrupted data)
 */
export function decryptCredential(encryptedCredential: EncryptedCredential): string {
  const { masterKey, keyVersion } = getEncryptionConfig()

  try {
    // Validate version matches current key
    if (encryptedCredential.version !== keyVersion) {
      throw new Error(
        `Credential encrypted with key version ${encryptedCredential.version}, but current version is ${keyVersion}`
      )
    }

    // Reconstruct buffers from base64
    const encrypted = Buffer.from(encryptedCredential.encrypted, 'base64')
    const nonce = Buffer.from(encryptedCredential.nonce, 'base64')
    const tag = Buffer.from(encryptedCredential.tag, 'base64')

    // Validate nonce length
    if (nonce.length !== 12) {
      throw new Error('Invalid nonce length')
    }

    // Create decipher
    const decipher = createDecipheriv(algorithm, masterKey, nonce)

    // Set authentication tag
    decipher.setAuthTag(tag)

    // Decrypt
    let plaintext = decipher.update(encrypted, 'hex', 'utf8')
    plaintext += decipher.final('utf8')

    return plaintext
  } catch (error) {
    // Log error details for debugging (never log the actual encrypted data or key)
    if (error instanceof Error) {
      throw new Error(`Credential decryption failed: ${error.message}`)
    }
    throw new Error('Credential decryption failed')
  }
}

/**
 * Hash a credential for duplicate detection
 * Uses SHA-256 to create a searchable hash without revealing the credential
 */
export function hashCredential(credential: string): string {
  return createHash('sha256').update(credential).digest('hex')
}
