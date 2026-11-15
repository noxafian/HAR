/**
 * AI Provider types for Phase A.
 *
 * SECURITY: This file must NEVER contain an API key field.
 * API keys are handled server-side only (Phase B).
 */

export type AIProvider =
  | 'openai'
  | 'gemini'
  | 'groq'
  | 'openrouter'
  | 'anthropic'

export type ConnectionStatus =
  | 'not-configured'
  | 'pending'
  | 'connected'
  | 'error'

/**
 * Public-facing provider config — contains NO key material.
 * Key storage is Phase B backend responsibility.
 */
export interface AIProviderConfig {
  provider: AIProvider
  /** Display label for the provider */
  label: string
  /** Selected model identifier (e.g. 'gpt-4o') */
  selectedModel: string | null
  status: ConnectionStatus
  connectedAt: Date | null
  /** Last error message if status === 'error' */
  errorMessage: string | null
}

export interface AIProviderMeta {
  provider: AIProvider
  label: string
  description: string
  models: string[]
  docsUrl: string
}

export const AI_PROVIDER_META: AIProviderMeta[] = [
  {
    provider: 'openai',
    label: 'OpenAI',
    description: 'GPT-4o and GPT-4 Turbo models for advanced study assistance.',
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    docsUrl: 'https://platform.openai.com/docs',
  },
  {
    provider: 'gemini',
    label: 'Google Gemini',
    description: 'Gemini 1.5 Pro with large context for document analysis.',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash'],
    docsUrl: 'https://ai.google.dev/docs',
  },
  {
    provider: 'groq',
    label: 'Groq',
    description: 'Ultra-fast inference with Llama and Mixtral models.',
    models: ['llama-3.1-70b-versatile', 'mixtral-8x7b-32768'],
    docsUrl: 'https://console.groq.com/docs',
  },
  {
    provider: 'openrouter',
    label: 'OpenRouter',
    description: 'Access multiple models through a single unified API.',
    models: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o', 'google/gemini-pro'],
    docsUrl: 'https://openrouter.ai/docs',
  },
  {
    provider: 'anthropic',
    label: 'Anthropic',
    description: 'Claude 3.5 Sonnet for nuanced explanations and analysis.',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
    docsUrl: 'https://docs.anthropic.com',
  },
]
