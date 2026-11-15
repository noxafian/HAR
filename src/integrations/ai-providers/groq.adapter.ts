/**
 * src/integrations/ai-providers/groq.adapter.ts
 * Groq Provider Adapter (High-speed LPU inference, OpenAI-compatible REST API)
 */

import type {
  IAIProvider,
  AIModelInfo,
  AIChatOptions,
  AIChatResponse,
  AIVerifyResult,
} from './interface'

export class GroqAdapter implements IAIProvider {
  readonly id = 'groq' as const
  readonly displayName = 'Groq'

  readonly supportedModels: AIModelInfo[] = [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Versatile & Fast)', contextWindow: 128000, default: true },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (Instant Inference)', contextWindow: 128000 },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (MoE Architecture)', contextWindow: 32768 },
  ]

  getDefaultModel(): string {
    return 'llama-3.3-70b-versatile'
  }

  validateKeyFormat(apiKey: string): boolean {
    return typeof apiKey === 'string' && apiKey.startsWith('gsk_') && apiKey.length >= 20
  }

  async verifyConnection(apiKey: string, modelId?: string): Promise<AIVerifyResult> {
    if (!this.validateKeyFormat(apiKey)) {
      return { valid: false, error: 'Invalid Groq API key format. Key should start with "gsk_"' }
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

      const response = await fetch('https://api.groq.com/openai/v1/models', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (response.status === 401) {
        return { valid: false, error: 'Invalid or revoked Groq API key' }
      }

      if (!response.ok) {
        const text = await response.text()
        return { valid: false, error: `Groq returned status ${response.status}: ${text}` }
      }

      return {
        valid: true,
        model: modelId || this.getDefaultModel(),
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed'
      return { valid: false, error: `Unable to reach Groq: ${message}` }
    }
  }

  async chat(options: AIChatOptions): Promise<AIChatResponse> {
    const model = options.modelId || this.getDefaultModel()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 30000)

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
        const errMsg = errJson?.error?.message || `Groq error: HTTP ${response.status}`
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
      throw err instanceof Error ? err : new Error('Groq chat request failed')
    }
  }

  async streamChat(options: AIChatOptions): Promise<ReadableStream<Uint8Array>> {
    const model = options.modelId || this.getDefaultModel()
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
      throw new Error(`Groq stream failed: HTTP ${response.status} ${errText}`)
    }

    return response.body
  }
}

