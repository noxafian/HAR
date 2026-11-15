/** Server-only AI credential repository. Ciphertext remains encrypted at rest. */
import 'server-only'
import { createServiceRoleClient } from '@/lib/server/supabase'
import type { EncryptedCredential } from '@/lib/server/encryption'

export interface AICredentialMetadata {
  id: string; userId: string; provider: 'openai' | 'gemini' | 'groq' | 'openrouter' | 'anthropic'
  modelId?: string; encrypted: string; nonce: string; tag: string; version: string
  credentialHash: string; createdAt: Date; updatedAt: Date; lastUsedAt?: Date
  usageCount: number; status: 'active' | 'disabled' | 'rotated'
}
export interface AICredentialRepository {
  store(data: StoreCredentialInput): Promise<AICredentialMetadata>
  getByUserId(userId: string, provider: string): Promise<AICredentialMetadata | null>
  getAllByUserId(userId: string): Promise<AICredentialMetadata[]>
  update(id: string, data: UpdateCredentialInput): Promise<AICredentialMetadata>
  disable(id: string): Promise<AICredentialMetadata>
  delete(id: string): Promise<void>
  recordUsage(id: string): Promise<void>
  hashExists(hash: string): Promise<boolean>
  listAll(filters?: CredentialListFilters): Promise<CredentialAuditMetadata[]>
}
export interface StoreCredentialInput {
  userId: string; provider: AICredentialMetadata['provider']; modelId?: string
  encrypted: EncryptedCredential; credentialHash: string
}
export interface UpdateCredentialInput {
  encrypted?: EncryptedCredential; credentialHash?: string; modelId?: string
  status?: 'active' | 'disabled' | 'rotated'
}
export interface CredentialListFilters { userId?: string; provider?: string; status?: string; limit?: number; offset?: number }
export type CredentialAuditMetadata = Pick<AICredentialMetadata, 'id' | 'userId' | 'provider' | 'modelId' | 'createdAt' | 'updatedAt' | 'lastUsedAt' | 'usageCount' | 'status'>

type Row = Record<string, unknown>
function asMetadata(row: Row): AICredentialMetadata {
  return {
    id: String(row.id), userId: String(row.userId), provider: row.provider as AICredentialMetadata['provider'],
    modelId: typeof row.modelId === 'string' ? row.modelId : undefined,
    encrypted: String(row.encrypted), nonce: String(row.nonce), tag: String(row.tag),
    version: String(row.version), credentialHash: String(row.credentialHash),
    createdAt: new Date(String(row.createdAt)), updatedAt: new Date(String(row.updatedAt)),
    lastUsedAt: row.lastUsedAt ? new Date(String(row.lastUsedAt)) : undefined,
    usageCount: Number(row.usageCount ?? 0), status: row.status as AICredentialMetadata['status'],
  }
}
async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const db = createServiceRoleClient()
  const { data, error } = await db.rpc(name, args)
  if (error) throw new Error(`AI credential repository ${name} failed: ${error.message}`)
  return data as T
}

export function createAICredentialRepository(): AICredentialRepository {
  return {
    async store(input) {
      const data = await call<Row>('ai_credential_store', {
        p_user_id: input.userId, p_provider: input.provider, p_model_id: input.modelId ?? null,
        p_encrypted: input.encrypted.encrypted, p_nonce: input.encrypted.nonce,
        p_tag: input.encrypted.tag, p_key_version: input.encrypted.version,
        p_credential_hash: input.credentialHash,
      })
      return asMetadata({ ...data, ...input.encrypted, credentialHash: input.credentialHash })
    },
    async getByUserId(userId, provider) {
      const data = await call<Row | null>('ai_credential_get', { p_user_id: userId, p_id: null, p_provider: provider })
      return data ? asMetadata(data) : null
    },
    async getAllByUserId(userId) {
      const list = await call<Row[]>('ai_credential_list', { p_user_id: userId })
      const records = await Promise.all((list ?? []).map(async item => {
        const data = await call<Row | null>('ai_credential_get', { p_user_id: userId, p_id: item.id, p_provider: null })
        return data ? asMetadata(data) : null
      }))
      return records.filter((item): item is AICredentialMetadata => item !== null)
    },
    async update(id, input) {
      const lookup = await call<Row | null>('ai_credential_get_any', { p_id: id })
      if (!lookup) throw new Error('Credential not found')
      const encrypted = input.encrypted ?? { encrypted: String(lookup.encrypted), nonce: String(lookup.nonce), tag: String(lookup.tag), version: String(lookup.version) }
      const credentialHash = input.credentialHash ?? String(lookup.credentialHash)
      if (input.status === 'disabled') {
        const changed = await call<boolean>('ai_credential_disable', { p_user_id: lookup.userId, p_id: id })
        if (!changed) throw new Error('Credential not found')
      } else {
        const changed = await call<Row | null>('ai_credential_update', {
          p_user_id: lookup.userId, p_id: id, p_encrypted: encrypted.encrypted, p_nonce: encrypted.nonce,
          p_tag: encrypted.tag, p_key_version: encrypted.version, p_credential_hash: credentialHash,
          p_model_id: input.modelId ?? null,
        })
        if (!changed) throw new Error('Credential not found')
      }
      const data = await call<Row | null>('ai_credential_get_any', { p_id: id })
      if (data) return asMetadata(data)
      throw new Error('Credential update could not be verified')
    },
    async disable(id) {
      const data = await call<Row | null>('ai_credential_get_any', { p_id: id })
      if (!data) throw new Error('Credential not found')
      const changed = await call<boolean>('ai_credential_disable', { p_user_id: data.userId, p_id: id })
      if (!changed) throw new Error('Credential not found')
      return { ...asMetadata(data), status: 'disabled', updatedAt: new Date() }
    },
    async delete(id) {
      const data = await call<Row | null>('ai_credential_get_any', { p_id: id })
      if (!data) return
      const deleted = await call<boolean>('ai_credential_delete', { p_user_id: data.userId, p_id: id })
      if (!deleted) throw new Error('Credential could not be deleted')
    },
    async recordUsage(id) {
      const data = await call<Row | null>('ai_credential_get_any', { p_id: id })
      if (!data) throw new Error('Credential not found')
      const recorded = await call<boolean>('ai_credential_record_usage', { p_user_id: data.userId, p_id: id })
      if (!recorded) throw new Error('Credential usage could not be recorded')
    },
    async hashExists(hash) { return call<boolean>('ai_credential_hash_exists', { p_hash: hash }) },
    async listAll(filters = {}) {
      return call<CredentialAuditMetadata[]>('ai_credential_admin_list', {
        p_user_id: filters.userId ?? null, p_provider: filters.provider ?? null,
        p_status: filters.status ?? null, p_limit: Math.min(200, Math.max(1, filters.limit ?? 100)),
        p_offset: Math.max(0, filters.offset ?? 0),
      }).then(rows => (rows ?? []).map(row => ({ ...row, createdAt: new Date(row.createdAt), updatedAt: new Date(row.updatedAt), lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt) : undefined })))
    },
  }
}
