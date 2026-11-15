/**
 * src/integrations/ai-providers/openai.adapter.ts
 * OpenAI Provider Adapter (REST / fetch-based, Next.js serverless optimized)
 */

import type {
  IAIProvider,
  AIModelInfo,
  AIChatOptions,
  AIChatResponse,
  AIVerifyResult,
} from './interface'

export class OpenAIAdapter implements IAIProvider {
  readonly id = 'openai' as const
  readonly displayName = 'OpenAI'

  readonly supportedModels: AIModelInfo[] = [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast & Efficient)', contextWindow: 128000, default: true },
    { id: 'gpt-4o', name: 'GPT-4o (High Intelligence)', contextWindow: 128000 },
    { id: 'o1-mini', name: 'o1-mini (Reasoning & Math)', contextWindow: 128000 },
  ]

  getDefaultModel(): string {
    return 'gpt-4o-mini'
  }

  validateKeyFormat(apiKey: string): boolean {
    return typeof apiKey === 'string' && apiKey.startsWith('sk-') && apiKey.length >= 20
  }

  async verifyConnection(apiKey: string, modelId?: string): Promise<AIVerifyResult> {
    if (!this.validateKeyFormat(apiKey)) {
      return { valid: false, error: 'Invalid OpenAI API key format. Key should start with "sk-"' }
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (response.status === 401) {
        return { valid: false, error: 'Invalid or revoked OpenAI API key' }
      }

      if (!response.ok) {
        const errorText = await response.text()
        return { valid: false, error: `OpenAI returned status ${response.status}: ${errorText}` }
      }

      return {
        valid: true,
        model: modelId || this.getDefaultModel(),
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed'
      return { valid: false, error: `Unable to reach OpenAI: ${message}` }
    }
  }

  async chat(options: AIChatOptions): Promise<AIChatResponse> {
    const model = options.modelId || this.getDefaultModel()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 30000)

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: options.messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 2048,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!response.ok) {
        const errJson = await response.json().catch(() => null)
        const errMsg = errJson?.error?.message || `OpenAI error: HTTP ${response.status}`
        throw new Error(errMsg)
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ''

      return {
        content,
        model: data.model || model,
        usage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          totalTokens: data.usage?.total_tokens,
        },
      }
    } catch (err) {
      clearTimeout(timeout)
      throw err instanceof Error ? err : new Error('OpenAI chat request failed')
    }
  }

  async streamChat(options: AIChatOptions): Promise<ReadableStream<Uint8Array>> {
    const model = options.modelId || this.getDefaultModel()
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
        stream: true,
      }),
    })

    if (!response.ok || !response.body) {
      const errText = await response.text().catch(() => '')
      throw new Error(`OpenAI stream failed: HTTP ${response.status} ${errText}`)
    }

    return response.body
  }
}

