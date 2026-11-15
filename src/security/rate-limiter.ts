/**
 * Persistent rate limiting for serverless deployments.
 * `devMemoryRateLimiter` is retained only as an explicit test/development utility;
 * production requests use atomic PostgreSQL UPSERTs through service-role RPCs.
 */
import { createServiceRoleClient } from '@/lib/server/supabase'

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  reset: Date
  retryAfter?: number
}
export interface RateLimiter {
  check(userId: string, action: string): Promise<RateLimitResult>
  consume(userId: string, action: string): Promise<RateLimitResult>
  reset(userId: string, action: string): Promise<void>
}
export interface RateLimitConfig { windowMs: number; maxRequests: number }

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  'ai.chat': { windowMs: 60_000, maxRequests: 10 },
  'ai.daily': { windowMs: 86_400_000, maxRequests: positiveInteger(process.env.AI_DAILY_REQUEST_LIMIT, 100) },
  'auth.login': { windowMs: 900_000, maxRequests: 10 },
  'auth.register': { windowMs: 3_600_000, maxRequests: 5 },
  'upload.intent': { windowMs: 3_600_000, maxRequests: 20 },
  default: { windowMs: 60_000, maxRequests: positiveInteger(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE, 30) },
}

type RpcRateLimit = { allowed: boolean; limit: number; remaining: number; reset: string; retryAfter?: number | null }
function mapRateLimit(data: RpcRateLimit | null, fallback: RateLimitConfig): RateLimitResult {
  if (!data || typeof data.allowed !== 'boolean') throw new Error('Rate-limit service returned an invalid response')
  return {
    allowed: data.allowed,
    limit: data.limit,
    remaining: data.remaining,
    reset: new Date(data.reset),
    retryAfter: data.retryAfter == null ? undefined : data.retryAfter,
  }
}

class DatabaseRateLimiter implements RateLimiter {
  private getConfig(action: string) { return RATE_LIMIT_CONFIGS[action] ?? RATE_LIMIT_CONFIGS.default }
  async check(userId: string, action: string): Promise<RateLimitResult> {
    const config = this.getConfig(action)
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_user_id: userId, p_action: action, p_limit: config.maxRequests,
      p_window_seconds: Math.ceil(config.windowMs / 1000),
    })
    if (error) throw new Error(`Rate-limit check failed: ${error.message}`)
    return mapRateLimit(data as RpcRateLimit | null, config)
  }
  async consume(userId: string, action: string): Promise<RateLimitResult> {
    const config = this.getConfig(action)
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase.rpc('consume_rate_limit', {
      p_user_id: userId, p_action: action, p_limit: config.maxRequests,
      p_window_seconds: Math.ceil(config.windowMs / 1000),
    })
    if (error) throw new Error(`Rate-limit consumption failed: ${error.message}`)
    return mapRateLimit(data as RpcRateLimit | null, config)
  }
  async reset(userId: string, action: string): Promise<void> {
    const supabase = createServiceRoleClient()
    const { error } = await supabase.rpc('reset_rate_limit', { p_user_id: userId, p_action: action })
    if (error) throw new Error(`Rate-limit reset failed: ${error.message}`)
  }
}

const memoryStore = new Map<string, { count: number; resetAt: Date }>()
export const devMemoryRateLimiter: RateLimiter = {
  async check(userId, action) {
    const config = RATE_LIMIT_CONFIGS[action] ?? RATE_LIMIT_CONFIGS.default
    const now = new Date()
    const record = memoryStore.get(`${userId}:${action}`)
    if (!record || now >= record.resetAt) return { allowed: true, limit: config.maxRequests, remaining: config.maxRequests, reset: new Date(now.getTime() + config.windowMs) }
    const remaining = Math.max(0, config.maxRequests - record.count)
    const allowed = remaining > 0
    return { allowed, limit: config.maxRequests, remaining, reset: record.resetAt, retryAfter: allowed ? undefined : Math.ceil((record.resetAt.getTime() - now.getTime()) / 1000) }
  },
  async consume(userId, action) {
    const config = RATE_LIMIT_CONFIGS[action] ?? RATE_LIMIT_CONFIGS.default
    const now = new Date()
    const key = `${userId}:${action}`
    const record = memoryStore.get(key)
    const resetAt = record && now < record.resetAt ? record.resetAt : new Date(now.getTime() + config.windowMs)
    const count = record && now < record.resetAt ? record.count + 1 : 1
    memoryStore.set(key, { count, resetAt })
    const allowed = count <= config.maxRequests
    return { allowed, limit: config.maxRequests, remaining: Math.max(0, config.maxRequests - count), reset: resetAt, retryAfter: allowed ? undefined : Math.ceil((resetAt.getTime() - now.getTime()) / 1000) }
  },
  async reset(userId, action) { memoryStore.delete(`${userId}:${action}`) },
}

export function getRateLimiter(): RateLimiter {
  return process.env.NODE_ENV === 'test' ? devMemoryRateLimiter : new DatabaseRateLimiter()
}
