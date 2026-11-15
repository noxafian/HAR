/**
 * src/test/security.test.ts
 * Comprehensive adversarial security test suite:
 * - Data isolation & access control
 * - Non-leakage of raw secrets & credentials
 * - File magic byte & extension verification
 * - Path traversal and input sanitization
 * - Rate limit enforcement
 * - Structured audit sanitization
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  validateFileExtension,
  validateFileType,
  validateFileMagicBytes,
  validateFileSize,
  sanitizeString,
  sanitizeFilename,
} from '@/security/validator'
import { devMemoryRateLimiter } from '@/security/rate-limiter'
import { logAuditEvent } from '@/security/audit'
import { AIConnectionService } from '@/services/ai-connection.service'
import { hasPermission } from '@/lib/server/authorization'
import type { UserProfile } from '@/types/user'

describe('Security & Adversarial Testing Suite', () => {
  beforeEach(() => {
    AIConnectionService._clearStore()
  })

  describe('1. Cross-User Data Isolation & Ownership Enforcement', () => {
    const userA = 'user-uuid-111'
    const userB = 'user-uuid-222'

    it('prevents User B from accessing or listing User A credentials', async () => {
      // User A connects OpenAI
      const connA = await AIConnectionService.connect(userA, {
        provider: 'openai',
        apiKey: 'sk-proj-user-a-secret-key-1234567890',
      })

      // User B lists connections -> must NOT see User A's connection
      const connectionsB = await AIConnectionService.listConnections(userB)
      expect(connectionsB).toHaveLength(0)

      // User B attempts to get User A's connection directly by ID
      const directGet = await AIConnectionService.getConnection(userB, connA.id)
      expect(directGet).toBeNull()
    })

    it('prevents User B from rotating or tampering with User A connection', async () => {
      const connA = await AIConnectionService.connect(userA, {
        provider: 'openai',
        apiKey: 'sk-proj-user-a-secret-key-1234567890',
      })

      // User B attempts to rotate User A's key
      await expect(
        AIConnectionService.rotateKey(userB, connA.id, {
          apiKey: 'sk-proj-malicious-new-key-1234567890',
        })
      ).rejects.toThrow(/not found or access denied/)
    })

    it('prevents User B from deleting User A connection', async () => {
      const connA = await AIConnectionService.connect(userA, {
        provider: 'openai',
        apiKey: 'sk-proj-user-a-secret-key-1234567890',
      })

      const disconnected = await AIConnectionService.disconnect(userB, connA.id)
      expect(disconnected).toBe(false)

      // Connection must still exist for User A
      const connCheck = await AIConnectionService.getConnection(userA, connA.id)
      expect(connCheck).not.toBeNull()
    })
  })

  describe('2. Credential Non-Leakage via Metadata & Audit', () => {
    it('never exposes raw API key, ciphertext, nonce, or tag in connection metadata', async () => {
      const user = 'user-test-leak'
      const rawKey = 'sk-proj-super-secret-key-1234567890'

      const meta = await AIConnectionService.connect(user, {
        provider: 'openai',
        apiKey: rawKey,
      })

      const serialized = JSON.stringify(meta)

      // Plaintext must never appear anywhere in the serialized response
      expect(serialized).not.toContain(rawKey)
      expect(meta).not.toHaveProperty('encrypted')
      expect(meta).not.toHaveProperty('nonce')
      expect(meta).not.toHaveProperty('tag')
      expect(meta).not.toHaveProperty('apiKey')
    })

    it('redacts sensitive fields in audit logging metadata', () => {
      const consoleSpy: string[] = []
      const originalLog = console.log
      console.log = (msg: string) => {
        consoleSpy.push(msg)
      }

      try {
        logAuditEvent('ai.connection_created', 'user-1', 'ai_credential', 'res-1', {
          metadata: {
            apiKey: 'sk-1234567890abcdef',
            password: 'SuperSecretPassword123',
            safeField: 'CS-Workspace',
          },
        })

        const logged = JSON.parse(consoleSpy[0])
        expect(logged.audit.metadata.apiKey).toBe('[REDACTED]')
        expect(logged.audit.metadata.password).toBe('[REDACTED]')
        expect(logged.audit.metadata.safeField).toBe('CS-Workspace')
      } finally {
        console.log = originalLog
      }
    })
  })

  describe('3. File Validation, Magic Bytes & Path Traversal Prevention', () => {
    it('rejects executable and dangerous file extensions', () => {
      const dangerous = ['malware.exe', 'script.sh', 'trojan.bat', 'payload.dll', 'hack.js', 'virus.vbs']
      for (const file of dangerous) {
        const result = validateFileExtension(file)
        expect(result.valid).toBe(false)
        expect(result.error).toMatch(/is not allowed/)
      }
    })

    it('validates genuine PDF magic bytes (%PDF) and rejects fake PDFs', () => {
      // Genuine PDF header: %PDF (0x25, 0x50, 0x44, 0x46)
      const validPdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])
      expect(validateFileMagicBytes(validPdfHeader, 'pdf')).toBe(true)

      // Renamed executable pretending to be PDF (MZ header 0x4D, 0x5A)
      const fakePdfHeader = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00])
      expect(validateFileMagicBytes(fakePdfHeader, 'pdf')).toBe(false)
    })

    it('validates genuine PNG and JPEG magic bytes', () => {
      const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      expect(validateFileMagicBytes(pngHeader, 'png')).toBe(true)

      const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46])
      expect(validateFileMagicBytes(jpegHeader, 'jpeg')).toBe(true)
      expect(validateFileMagicBytes(jpegHeader, 'jpg')).toBe(true)
    })

    it('rejects Content-Type mismatch against extension', () => {
      const mismatch = validateFileType('notes.pdf', 'image/png')
      expect(mismatch.valid).toBe(false)
      expect(mismatch.error).toMatch(/Content-Type mismatch/)
    })

    it('rejects oversized and empty files', () => {
      // > 50 MB
      expect(validateFileSize(60 * 1024 * 1024).valid).toBe(false)
      // 0 bytes
      expect(validateFileSize(0).valid).toBe(false)
      // Valid 5 MB
      expect(validateFileSize(5 * 1024 * 1024).valid).toBe(true)
    })

    it('sanitizes path traversal attempts in filenames', () => {
      const dangerousPath = '../../../../etc/passwd'
      const sanitized = sanitizeFilename(dangerousPath)
      expect(sanitized).not.toContain('../')
      expect(sanitized).not.toContain('/')
      expect(sanitized).not.toContain('\\')

      const windowsTraversal = '..\\..\\Windows\\System32\\cmd.exe'
      const sanitizedWin = sanitizeFilename(windowsTraversal)
      expect(sanitizedWin).not.toContain('\\')
      expect(sanitizedWin).not.toContain('..')
    })

    it('sanitizes control characters from strings', () => {
      const dirty = 'NormalText\x00\x08\x1B[31mInjected\x7F'
      const cleaned = sanitizeString(dirty)
      expect(cleaned).toBe('NormalText[31mInjected')
    })
  })

  describe('4. Rate Limiting Enforcement', () => {
    it('enforces request thresholds and calculates retry-after', async () => {
      const testUser = 'user-rate-limit-test'
      const action = 'ai.chat' // limit is 10 requests per minute

      await devMemoryRateLimiter.reset(testUser, action)

      // Consume 10 allowed requests
      for (let i = 0; i < 10; i++) {
        const res = await devMemoryRateLimiter.consume(testUser, action)
        expect(res.allowed).toBe(true)
      }

      // 11th request must be blocked
      const blocked = await devMemoryRateLimiter.check(testUser, action)
      expect(blocked.allowed).toBe(false)
      expect(blocked.remaining).toBe(0)
      expect(blocked.retryAfter).toBeGreaterThan(0)

      const blockedConsume = await devMemoryRateLimiter.consume(testUser, action)
      expect(blockedConsume.allowed).toBe(false)
    })
  })

  describe('5. Role-Based Permission Matrix Enforcements', () => {
    const memberUser: UserProfile = {
      id: 'm-1',
      email: 'member@studyhub.internal',
      displayName: 'Member One',
      avatarUrl: null,
      role: 'member',
      examPapers: ['CS'],
      joinedAt: new Date(),
      isActive: true,
    }

    const moderatorUser: UserProfile = {
      id: 'mod-1',
      email: 'mod@studyhub.internal',
      displayName: 'Mod One',
      avatarUrl: null,
      role: 'member',
      examPapers: ['CS', 'DA'],
      joinedAt: new Date(),
      isActive: true,
    }

    it('blocks regular members and moderators from administrative member approval', () => {
      expect(hasPermission(memberUser, 'member:approve')).toBe(false)
      expect(hasPermission(moderatorUser, 'member:approve')).toBe(false)
    })

    it('blocks members from moderating community content while allowing moderators', () => {
      expect(hasPermission(memberUser, 'content:moderate', 'community')).toBe(false)
      expect(hasPermission(moderatorUser, 'content:moderate', 'community')).toBe(true)
    })

    it('blocks users from accessing other users AI connection management', () => {
      expect(hasPermission(memberUser, 'ai-connection:manage', 'own')).toBe(true)
      expect(hasPermission(memberUser, 'ai-connection:manage', 'others')).toBe(false)
    })
  })
})
