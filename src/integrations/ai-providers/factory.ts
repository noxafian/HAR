/**
 * src/integrations/ai-providers/factory.ts
 * AI Provider Factory and Registry
 */

import type { IAIProvider } from './interface'
import type { SupportedAIProvider } from '@/schemas/ai.schema'
import { OpenAIAdapter } from './openai.adapter'
import { GeminiAdapter } from './gemini.adapter'
import { GroqAdapter } from './groq.adapter'
import { OpenRouterAdapter } from './openrouter.adapter'
import { AnthropicAdapter } from './anthropic.adapter'

const providers: Record<SupportedAIProvider, IAIProvider> = {
  openai: new OpenAIAdapter(),
  gemini: new GeminiAdapter(),
  groq: new GroqAdapter(),
  openrouter: new OpenRouterAdapter(),
  anthropic: new AnthropicAdapter(),
}

/**
 * Get an AI provider adapter by provider identifier
 */
export function getAIProvider(providerId: string): IAIProvider {
  const provider = providers[providerId as SupportedAIProvider]
  if (!provider) {
    throw new Error(
      `Unsupported AI provider: "${providerId}". Supported providers are: ${Object.keys(providers).join(', ')}`
    )
  }
  return provider
}

/**
 * Get list of all registered AI provider adapters
 */
export function getAllAIProviders(): IAIProvider[] {
  return Object.values(providers)
}

export * from './interface'

