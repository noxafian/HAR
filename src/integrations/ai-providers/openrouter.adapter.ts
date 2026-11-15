/**
 * src/integrations/ai-providers/openrouter.adapter.ts
 * OpenRouter Provider Adapter (Multi-model routing, OpenAI-compatible REST API)
 */

import type {
  IAIProvider,
  AIModelInfo,
  AIChatOptions,
  AIChatResponse,
  AIVerifyResult,
} from './interface'

export class OpenRouterAdapter implements IAIProvider {
  readonly id = 'openrouter' as const
  readonly displayName = 'OpenRouter'

  readonly supportedModels: AIModelInfo[] = [
    { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct', contextWindow: 128000, default: true },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (via OpenRouter)', contextWindow: 200000 },
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', contextWindow: 64000 },
  ]

  getDefaultModel(): string {
    return 'meta-llama/llama-3.3-70b-instruct'
  }

  validateKeyFormat(apiKey: string): boolean {
    return (
      typeof apiKey === 'string' &&
      (apiKey.startsWith('sk-or-v1-') || apiKey.startsWith('sk-or-')) &&
      apiKey.length >= 20
    )
  }

  async verifyConnection(apiKey: string, modelId?: string): Promise<AIVerifyResult> {
    if (!this.validateKeyFormat(apiKey)) {
      return { valid: false, error: 'Invalid OpenRouter API key format. Key should start with "sk-or-"' }
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

      const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (response.status === 401) {
        return { valid: false, error: 'Invalid or revoked OpenRouter API key' }
      }

      if (!response.ok) {
        const text = await response.text()
        return { valid: false, error: `OpenRouter returned status ${response.status}: ${text}` }
      }

      return {
        valid: true,
        model: modelId || this.getDefaultModel(),
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed'
      return { valid: false, error: `Unable to reach OpenRouter: ${message}` }
    }
  }

  async chat(options: AIChatOptions): Promise<AIChatResponse> {
    const model = options.modelId || this.getDefaultModel()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 30000)

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${options.apiKey}`,
          'HTTP-Referer': 'https://keryvion.com',
          'X-Title': 'Keryvion StudyHub',
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
        const errMsg = errJson?.error?.message || `OpenRouter error: HTTP ${response.status}`
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
      throw err instanceof Error ? err : new Error('OpenRouter chat request failed')
    }
  }

  async streamChat(options: AIChatOptions): Promise<ReadableStream<Uint8Array>> {
    const model = options.modelId || this.getDefaultModel()
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.apiKey}`,
        'HTTP-Referer': 'https://keryvion.com',
        'X-Title': 'Keryvion StudyHub',
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
      throw new Error(`OpenRouter stream failed: HTTP ${response.status} ${errText}`)
    }

    return response.body
  }
}

