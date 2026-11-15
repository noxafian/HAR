/**
 * Encryption module tests
 * Tests encrypt/decrypt roundtrip, tamper detection, and version checking
 */
import { describe, it, expect } from 'vitest'

// Set required env before importing the module
process.env.ENCRYPTION_MASTER_KEY = 'a'.repeat(64)
process.env.ENCRYPTION_KEY_VERSION = '1'

import { encryptCredential, decryptCredential, hashCredential } from '@/lib/server/encryption'

describe('encryptCredential / decryptCredential', () => {
  it('roundtrip: decrypted value matches original', () => {
    const original = 'sk-test-key-abc123'
    const enc = encryptCredential(original)
    const dec = decryptCredential(enc)
    expect(dec).toBe(original)
  })

  it('produces different nonces each call (randomness)', () => {
    const enc1 = encryptCredential('same-key')
    const enc2 = encryptCredential('same-key')
    expect(enc1.nonce).not.toBe(enc2.nonce)
    expect(enc1.encrypted).not.toBe(enc2.encrypted)
  })

  it('ciphertext is not the original plaintext', () => {
    const enc = encryptCredential('super-secret-api-key')
    expect(enc.encrypted).not.toContain('super-secret')
  })

  it('tampered authentication tag causes decryption to throw', () => {
    const enc = encryptCredential('api-key-value')
    const tampered = { ...enc, tag: Buffer.from('badtag00badtag00', 'hex').toString('base64') }
    expect(() => decryptCredential(tampered)).toThrow()
  })

  it('tampered ciphertext causes decryption to throw', () => {
    const enc = encryptCredential('api-key-value')
    // Flip a byte in the encrypted content
    const buf = Buffer.from(enc.encrypted, 'base64')
    buf[0] ^= 0xff
    const tampered = { ...enc, encrypted: buf.toString('base64') }
    expect(() => decryptCredential(tampered)).toThrow()
  })

  it('wrong key version causes decryption to throw', () => {
    const enc = encryptCredential('api-key-value')
    const wrongVersion = { ...enc, version: '99' }
    expect(() => decryptCredential(wrongVersion)).toThrow()
  })

  it('encrypted structure has required fields', () => {
    const enc = encryptCredential('test')
    expect(enc).toHaveProperty('encrypted')
    expect(enc).toHaveProperty('nonce')
    expect(enc).toHaveProperty('tag')
    expect(enc).toHaveProperty('version')
  })
})

describe('hashCredential', () => {
  it('returns consistent SHA-256 hex for same input', () => {
    const h1 = hashCredential('api-key-123')
    const h2 = hashCredential('api-key-123')
    expect(h1).toBe(h2)
    expect(h1).toHaveLength(64)
    expect(h1).toMatch(/^[0-9a-f]{64}$/)
  })

  it('different inputs produce different hashes', () => {
    expect(hashCredential('key-a')).not.toBe(hashCredential('key-b'))
  })

  it('never returns the original input', () => {
    const key = 'sk-openai-secretkey'
    expect(hashCredential(key)).not.toContain(key)
  })
})
