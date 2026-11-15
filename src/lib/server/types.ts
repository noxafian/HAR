/**
 * src/lib/server/types.ts
 * Server-side type definitions
 */

import type { NextRequest } from 'next/server'
import type { UserProfile } from '@/types/user'

/**
 * Standard API response envelope for successful requests
 */
export interface ApiResponse<T> {
  success: true
  data: T
  message: string
  meta?: Record<string, unknown>
}

/**
 * Standard API error response envelope
 */
export interface ApiError {
  success: false
  errorId: string
  message: string
  timestamp: string
  details?: Record<string, unknown>
}

/**
 * Request context with authenticated user information
 */
export interface ApiContext {
  user: UserProfile | null
  sessionToken: string | null
  request: NextRequest
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number
  limit?: number
  offset?: number
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

/**
 * Upload session metadata
 */
export interface UploadSession {
  id: string
  userId: string
  fileName: string
  fileSize: number
  fileType: string
  contentHash: string
  createdAt: Date
  expiresAt: Date
  status: 'pending' | 'completed' | 'failed'
}

/**
 * Signed URL for uploads/downloads
 */
export interface SignedUrl {
  url: string
  expiresIn: number // seconds
  expiresAt: Date
  method: 'PUT' | 'GET'
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id: string
  userId: string
  action: string
  resourceType: string
  resourceId: string
  changes: Record<string, unknown>
  status: 'success' | 'failure'
  errorMessage?: string
  ipAddress?: string
  userAgent?: string
  timestamp: Date
}

/**
 * Rate limit info
 */
export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: Date
  retryAfter?: number
}

/**
 * Request validation error
 */
export interface ValidationError {
  field: string
  message: string
  code: string
}

/**
 * Database query builder result
 */
export interface QueryResult<T> {
  data: T | null
  error: Error | null
  count?: number
}

/**
 * Credential storage metadata (does NOT contain the actual credential)
 */
export interface StoredCredentialMetadata {
  id: string
  userId: string
  provider: string
  modelId?: string
  encrypted: string
  nonce: string
  tag: string
  version: string
  createdAt: Date
  updatedAt: Date
  lastUsedAt: Date | null
  usageCount: number
  status: 'active' | 'disabled' | 'rotated'
}

/**
 * AI provider connection info (safe to return to frontend)
 */
export interface AIProviderConnectionInfo {
  id: string
  provider: string
  status: 'not-configured' | 'pending' | 'connected' | 'error'
  modelId?: string
  createdAt: Date
  lastVerifiedAt: Date | null
  error?: string
  usageToday?: number
  usageThisMonth?: number
}

/**
 * Mock exam submission
 */
export interface MockExamSubmission {
  id: string
  userId: string
  examId: string
  startedAt: Date
  submittedAt: Date
  duration: number // seconds
  answers: Record<string, string> // questionId -> answer
  markedForReview: string[] // questionIds marked for review
  score?: number
  details?: {
    correct: number
    incorrect: number
    unanswered: number
    marks: number
  }
}

/**
 * Question response with metadata
 */
export interface QuestionDetail {
  id: string
  text: string
  type: 'mcq' | 'msq' | 'nat'
  options?: string[]
  correctAnswer: string | number | string[]
  explanation?: string
  sourceDocument?: string
  classification: 'official-pyq' | 'member-contributed' | 'ai-generated' | 'unverified'
  subject?: string
  topic?: string
  paper?: string
  year?: number
  difficulty?: 'easy' | 'medium' | 'hard'
}

/**
 * Flashcard data
 */
export interface FlashcardData {
  id: string
  userId: string
  front: string
  back: string
  subject?: string
  topic?: string
  source?: string
  isAiGenerated?: boolean
  nextReviewAt?: Date
  reviewCount: number
  difficulty: number // 1-5
  createdAt: Date
  updatedAt: Date
}

/**
 * Study session data
 */
export interface StudySession {
  id: string
  userId: string
  subject?: string
  topic?: string
  startTime: Date
  endTime?: Date
  duration?: number // seconds
  questionsAttempted?: number
  questionsCorrect?: number
  sessionType: 'focused' | 'revision' | 'practice' | 'exam'
}
