/**
 * src/integrations/ai-providers/interface.ts
 * Common interface and contracts for personal AI provider adapters
 */

import type { SupportedAIProvider } from '@/schemas/ai.schema'

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIModelInfo {
  id: string
  name: string
  contextWindow?: number
  default?: boolean
}

export interface AIChatOptions {
  apiKey: string
  modelId?: string
  messages: AIMessage[]
  temperature?: number
  maxTokens?: number
  timeoutMs?: number
}

export interface AITokenUsage {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

export interface AIChatResponse {
  content: string
  model: string
  usage?: AITokenUsage
}

export interface AIVerifyResult {
  valid: boolean
  model?: string
  error?: string
}

export interface IAIProvider {
  readonly id: SupportedAIProvider
  readonly displayName: string
  readonly supportedModels: AIModelInfo[]

  /**
   * Get the default recommended model for this provider
   */
  getDefaultModel(): string

  /**
   * Perform initial format verification of the API key
   */
  validateKeyFormat(apiKey: string): boolean

  /**
   * Test live connectivity with the provider using the provided key
   */
  verifyConnection(apiKey: string, modelId?: string): Promise<AIVerifyResult>

  /**
   * Complete non-streaming chat request
   */
  chat(options: AIChatOptions): Promise<AIChatResponse>

  /**
   * Streaming chat request yielding SSE text chunks
   */
  streamChat?(options: AIChatOptions): Promise<ReadableStream<Uint8Array>>
}

