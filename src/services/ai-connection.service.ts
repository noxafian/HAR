/**
 * Server-side AI provider connections.
 * Production ciphertext and metadata live in private PostgreSQL storage and
 * are reachable only through service-role RPCs. A process-local adapter exists
 * only under NODE_ENV=test to preserve isolated unit tests without an external DB.
 */
import crypto from 'crypto'
import {
  encryptCredential,
  decryptCredential,
  hashCredential,
  type EncryptedCredential,
} from '@/lib/server/encryption'
import type { AICredentialMetadata } from '@/repositories/ai-credential.repository'
import { createServiceRoleClient } from '@/lib/server/supabase'
import { getAIProvider, type AIMessage, type AIChatResponse, type AIVerifyResult } from '@/integrations/ai-providers/factory'
import type { SupportedAIProvider, ConnectProviderInput, RotateKeyInput } from '@/schemas/ai.schema'
import { logAuditEvent } from '@/security/audit'
import { getRateLimiter } from '@/security/rate-limiter'

export interface SafeAIConnectionMetadata {
  id: string
  userId: string
  provider: SupportedAIProvider
  modelId?: string
  status: 'active' | 'disabled' | 'rotated'
  createdAt: string
  updatedAt: string
  lastUsedAt?: string
  usageCount: number
}

type StoredCredential = AICredentialMetadata & { id: string }
type DatabaseCredential = {
  id: string; userId: string; provider: SupportedAIProvider; modelId?: string | null
  encrypted: string; nonce: string; tag: string; version: string; credentialHash: string
  createdAt: string; updatedAt: string; lastUsedAt?: string | null; usageCount: number
  status: 'active' | 'disabled' | 'rotated'
}

// Deliberately inaccessible in production; production code never reads or writes this map.
const testStore = new Map<string, StoredCredential>()
const isTestAdapter = () => process.env.NODE_ENV === 'test'

function toSafeMetadata(record: Pick<DatabaseCredential, 'id' | 'userId' | 'provider' | 'modelId' | 'status' | 'createdAt' | 'updatedAt' | 'lastUsedAt' | 'usageCount'>): SafeAIConnectionMetadata {
  return {
    id: record.id, userId: record.userId, provider: record.provider,
    modelId: record.modelId ?? undefined, status: record.status,
    createdAt: new Date(record.createdAt).toISOString(),
    updatedAt: new Date(record.updatedAt).toISOString(),
    lastUsedAt: record.lastUsedAt ? new Date(record.lastUsedAt).toISOString() : undefined,
    usageCount: Number(record.usageCount),
  }
}

function fromDatabase(data: unknown): DatabaseCredential | null {
  if (!data || typeof data !== 'object') return null
  const row = data as Record<string, unknown>
  if (typeof row.id !== 'string' || typeof row.userId !== 'string' || typeof row.provider !== 'string'
    || typeof row.encrypted !== 'string' || typeof row.nonce !== 'string' || typeof row.tag !== 'string'
    || typeof row.version !== 'string' || typeof row.credentialHash !== 'string') return null
  return {
    id: row.id, userId: row.userId, provider: row.provider as SupportedAIProvider,
    modelId: typeof row.modelId === 'string' ? row.modelId : undefined,
    encrypted: row.encrypted, nonce: row.nonce, tag: row.tag, version: row.version,
    credentialHash: row.credentialHash, createdAt: String(row.createdAt ?? new Date().toISOString()),
    updatedAt: String(row.updatedAt ?? new Date().toISOString()),
    lastUsedAt: typeof row.lastUsedAt === 'string' ? row.lastUsedAt : null,
    usageCount: Number(row.usageCount ?? 0), status: row.status as DatabaseCredential['status'],
  }
}

function toTestDb(record: StoredCredential): DatabaseCredential {
  return {
    id: record.id, userId: record.userId, provider: record.provider, modelId: record.modelId,
    encrypted: record.encrypted, nonce: record.nonce, tag: record.tag, version: record.version,
    credentialHash: record.credentialHash, createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(), lastUsedAt: record.lastUsedAt?.toISOString() ?? null,
    usageCount: record.usageCount, status: record.status,
  }
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.rpc(name, args)
  if (error) {
    const err = new Error(error.message) as Error & { code?: string; status?: number }
    err.code = error.code
    err.status = error.code === '42501' ? 403 : 500
    throw err
  }
  return data as T
}

function notFoundError() {
  const error = new Error('Connection not found or access denied') as Error & { status?: number; code?: string }
  error.status = 404
  error.code = 'AI_CONNECTION_NOT_FOUND'
  return error
}

function noCredentialError() {
  const error = new Error('No active AI connection found for the requested provider. Please connect your API key first.') as Error & { status?: number; code?: string }
  error.status = 404
  error.code = 'AI_CONNECTION_NOT_FOUND'
  return error
}

export class AIConnectionService {
  static async listConnections(userId: string): Promise<SafeAIConnectionMetadata[]> {
    if (isTestAdapter()) return [...testStore.values()].filter(item => item.userId === userId).map(item => toSafeMetadata(toTestDb(item)))
    const rows = await rpc<unknown>('ai_credential_list', { p_user_id: userId })
    if (!Array.isArray(rows)) throw new Error('Credential listing returned an invalid response')
    return rows.map(row => {
      const item = row as Record<string, unknown>
      return toSafeMetadata({
        id: String(item.id), userId: String(item.userId), provider: item.provider as SupportedAIProvider,
        modelId: typeof item.modelId === 'string' ? item.modelId : undefined,
        status: item.status as DatabaseCredential['status'], createdAt: String(item.createdAt),
        updatedAt: String(item.updatedAt), lastUsedAt: typeof item.lastUsedAt === 'string' ? item.lastUsedAt : null,
        usageCount: Number(item.usageCount ?? 0),
      })
    })
  }

  static async getConnection(userId: string, connectionId: string): Promise<SafeAIConnectionMetadata | null> {
    if (isTestAdapter()) {
      const row = testStore.get(connectionId)
      return !row || row.userId !== userId ? null : toSafeMetadata(toTestDb(row))
    }
    const row = fromDatabase(await rpc<unknown>('ai_credential_get', { p_user_id: userId, p_id: connectionId, p_provider: null }))
    return !row || row.userId !== userId ? null : toSafeMetadata(row)
  }

  private static async getEncryptedCredential(userId: string, connectionId?: string, provider?: SupportedAIProvider): Promise<DatabaseCredential | null> {
    if (isTestAdapter()) {
      const row = connectionId ? testStore.get(connectionId) : [...testStore.values()].find(value => value.userId === userId && value.provider === provider)
      return !row || row.userId !== userId || row.status === 'disabled' ? null : toTestDb(row)
    }
    return fromDatabase(await rpc<unknown>('ai_credential_get', {
      p_user_id: userId, p_id: connectionId ?? null, p_provider: provider ?? null,
    }))
  }

  static async connect(userId: string, input: ConnectProviderInput): Promise<SafeAIConnectionMetadata> {
    const provider = getAIProvider(input.provider)
    if (!provider.validateKeyFormat(input.apiKey)) throw new Error(`Invalid API key format for provider ${input.provider}`)
    const credentialHash = hashCredential(input.apiKey)
    const encrypted: EncryptedCredential = encryptCredential(input.apiKey)

    if (isTestAdapter()) {
      for (const existing of testStore.values()) {
        if (existing.userId === userId && existing.credentialHash === credentialHash) throw new Error('This API key is already connected to your account')
      }
      const now = new Date()
      const record: StoredCredential = {
        id: crypto.randomUUID(), userId, provider: input.provider, modelId: input.modelId || provider.getDefaultModel(),
        encrypted: encrypted.encrypted, nonce: encrypted.nonce, tag: encrypted.tag, version: encrypted.version,
        credentialHash, createdAt: now, updatedAt: now, usageCount: 0, status: 'active',
      }
      testStore.set(record.id, record)
      await logAuditEvent('ai.connection_created', userId, 'ai_credential', record.id, { status: 'success', metadata: { provider: input.provider, modelId: record.modelId } })
      return toSafeMetadata(toTestDb(record))
    }

    const exists = await rpc<boolean>('ai_credential_hash_exists', { p_hash: credentialHash })
    if (exists) throw new Error('This API key is already connected to an account')
    const existingProvider = (await this.listConnections(userId)).find(item => item.provider === input.provider && item.status !== 'disabled')
    if (existingProvider) throw new Error('This provider is already connected. Rotate the existing key instead.')
    const data = await rpc<unknown>('ai_credential_store', {
      p_user_id: userId, p_provider: input.provider, p_model_id: input.modelId || provider.getDefaultModel(),
      p_encrypted: encrypted.encrypted, p_nonce: encrypted.nonce, p_tag: encrypted.tag,
      p_key_version: encrypted.version, p_credential_hash: credentialHash,
    })
    const record = fromDatabase({ ...(data as Record<string, unknown>), encrypted: encrypted.encrypted, nonce: encrypted.nonce, tag: encrypted.tag, version: encrypted.version, credentialHash })
    if (!record) throw new Error('Credential storage returned an invalid response')
    await logAuditEvent('ai.connection_created', userId, 'ai_credential', record.id, { status: 'success', metadata: { provider: input.provider, modelId: record.modelId } })
    return toSafeMetadata(record)
  }

  static async rotateKey(userId: string, connectionId: string, input: RotateKeyInput): Promise<SafeAIConnectionMetadata> {
    const existing = await this.getEncryptedCredential(userId, connectionId)
    if (!existing) throw notFoundError()
    const provider = getAIProvider(existing.provider)
    if (!provider.validateKeyFormat(input.apiKey)) throw new Error(`Invalid API key format for provider ${existing.provider}`)
    const credentialHash = hashCredential(input.apiKey)
    const encrypted = encryptCredential(input.apiKey)

    if (isTestAdapter()) {
      const testRecord = testStore.get(connectionId)
      if (!testRecord || testRecord.userId !== userId) throw notFoundError()
      Object.assign(testRecord, encrypted, { credentialHash, updatedAt: new Date(), status: 'rotated' as const })
      if (input.modelId) testRecord.modelId = input.modelId
      testStore.set(connectionId, testRecord)
      await logAuditEvent('ai.key_rotated', userId, 'ai_credential', connectionId, { status: 'success', metadata: { provider: existing.provider } })
      return toSafeMetadata(toTestDb(testRecord))
    }

    const duplicate = await rpc<boolean>('ai_credential_hash_exists', { p_hash: credentialHash })
    if (duplicate && credentialHash !== existing.credentialHash) throw new Error('This API key is already connected to an account')
    const data = await rpc<unknown>('ai_credential_update', {
      p_user_id: userId, p_id: connectionId, p_encrypted: encrypted.encrypted,
      p_nonce: encrypted.nonce, p_tag: encrypted.tag, p_key_version: encrypted.version,
      p_credential_hash: credentialHash, p_model_id: input.modelId ?? null,
    })
    const updated = fromDatabase({ ...(data as Record<string, unknown>), encrypted: encrypted.encrypted, nonce: encrypted.nonce, tag: encrypted.tag, version: encrypted.version, credentialHash })
    if (!updated) throw notFoundError()
    await logAuditEvent('ai.key_rotated', userId, 'ai_credential', connectionId, { status: 'success', metadata: { provider: existing.provider } })
    return toSafeMetadata(updated)
  }

  static async verify(userId: string, connectionId: string, modelId?: string): Promise<AIVerifyResult> {
    const existing = await this.getEncryptedCredential(userId, connectionId)
    if (!existing) return { valid: false, error: 'Connection not found or access denied' }
    const plaintextKey = decryptCredential({ encrypted: existing.encrypted, nonce: existing.nonce, tag: existing.tag, version: existing.version })
    const provider = getAIProvider(existing.provider)
    const result = await provider.verifyConnection(plaintextKey, (modelId || existing.modelId) ?? undefined)
    await logAuditEvent('ai.connection_verified', userId, 'ai_credential', connectionId, {
      status: result.valid ? 'success' : 'failure', errorMessage: result.error,
      metadata: { provider: existing.provider, valid: result.valid },
    })
    return result
  }

  static async disconnect(userId: string, connectionId: string): Promise<boolean> {
    if (isTestAdapter()) {
      const existing = testStore.get(connectionId)
      if (!existing || existing.userId !== userId) return false
      testStore.delete(connectionId)
      await logAuditEvent('ai.connection_deleted', userId, 'ai_credential', connectionId, { status: 'success', metadata: { provider: existing.provider } })
      return true
    }
    const existing = await this.getEncryptedCredential(userId, connectionId)
    if (!existing) return false
    const removed = await rpc<boolean>('ai_credential_delete', { p_user_id: userId, p_id: connectionId })
    if (removed) await logAuditEvent('ai.connection_deleted', userId, 'ai_credential', connectionId, { status: 'success', metadata: { provider: existing.provider } })
    return removed
  }

  static async chat(userId: string, options: {
    connectionId?: string; provider?: SupportedAIProvider; messages: AIMessage[];
    temperature?: number; maxTokens?: number; stream?: boolean
  }): Promise<AIChatResponse | ReadableStream<Uint8Array>> {
    const rateLimiter = getRateLimiter()
    const daily = await rateLimiter.consume(userId, 'ai.daily')
    if (!daily.allowed) {
      const err = new Error(`Daily AI request limit reached. Try again in ${daily.retryAfter ?? 3600} seconds.`) as Error & { status?: number; code?: string }
      err.status = 429; err.code = 'AI_DAILY_LIMIT_EXCEEDED'; throw err
    }
    const limitCheck = await rateLimiter.check(userId, 'ai.chat')
    if (!limitCheck.allowed) {
      const err = new Error(`Per-minute AI rate limit exceeded. Try again in ${limitCheck.retryAfter ?? 60} seconds.`) as Error & { status?: number; code?: string }
      err.status = 429; err.code = 'RATE_LIMIT_EXCEEDED'; throw err
    }
    const consumed = await rateLimiter.consume(userId, 'ai.chat')
    if (!consumed.allowed) {
      const err = new Error(`Per-minute AI rate limit exceeded. Try again in ${consumed.retryAfter ?? 60} seconds.`) as Error & { status?: number; code?: string }
      err.status = 429; err.code = 'RATE_LIMIT_EXCEEDED'; throw err
    }

    const credential = await this.getEncryptedCredential(userId, options.connectionId, options.provider)
    if (!credential) throw noCredentialError()
    const plaintextKey = decryptCredential({ encrypted: credential.encrypted, nonce: credential.nonce, tag: credential.tag, version: credential.version })
    const providerAdapter = getAIProvider(credential.provider)

    if (isTestAdapter()) {
      const row = testStore.get(credential.id)
      if (row) { row.usageCount += 1; row.lastUsedAt = new Date(); }
    } else {
      await rpc<boolean>('ai_credential_record_usage', { p_user_id: userId, p_id: credential.id })
    }

    if (options.stream && providerAdapter.streamChat) {
      return providerAdapter.streamChat({ apiKey: plaintextKey, modelId: credential.modelId ?? undefined, messages: options.messages, temperature: options.temperature, maxTokens: options.maxTokens })
    }
    return providerAdapter.chat({ apiKey: plaintextKey, modelId: credential.modelId ?? undefined, messages: options.messages, temperature: options.temperature, maxTokens: options.maxTokens })
  }

  /** Test-only state reset; production persistence remains in PostgreSQL. */
  static _clearStore(): void {
    if (isTestAdapter()) testStore.clear()
  }
}
