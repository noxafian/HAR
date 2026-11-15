/**
 * src/integrations/ai-providers/anthropic.adapter.ts
 * Anthropic Provider Adapter (Claude 3.5 series REST API)
 */

import type {
  IAIProvider,
  AIModelInfo,
  AIChatOptions,
  AIChatResponse,
  AIVerifyResult,
} from './interface'

export class AnthropicAdapter implements IAIProvider {
  readonly id = 'anthropic' as const
  readonly displayName = 'Anthropic'

  readonly supportedModels: AIModelInfo[] = [
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (State-of-the-Art)', contextWindow: 200000, default: true },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Fast & Accurate)', contextWindow: 200000 },
  ]

  getDefaultModel(): string {
    return 'claude-3-5-sonnet-20241022'
  }

  validateKeyFormat(apiKey: string): boolean {
    return typeof apiKey === 'string' && apiKey.startsWith('sk-ant-') && apiKey.length >= 20
  }

  async verifyConnection(apiKey: string, modelId?: string): Promise<AIVerifyResult> {
    if (!this.validateKeyFormat(apiKey)) {
      return { valid: false, error: 'Invalid Anthropic API key format. Key should start with "sk-ant-"' }
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: modelId || this.getDefaultModel(),
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Ping' }],
        }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (response.status === 401) {
        return { valid: false, error: 'Invalid or revoked Anthropic API key' }
      }

      if (!response.ok) {
        const text = await response.text()
        return { valid: false, error: `Anthropic returned status ${response.status}: ${text}` }
      }

      return {
        valid: true,
        model: modelId || this.getDefaultModel(),
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed'
      return { valid: false, error: `Unable to reach Anthropic: ${message}` }
    }
  }

  async chat(options: AIChatOptions): Promise<AIChatResponse> {
    const model = options.modelId || this.getDefaultModel()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 30000)

    try {
      const systemMessages = options.messages.filter((m) => m.role === 'system')
      const conversationMessages = options.messages.filter((m) => m.role !== 'system')

      const payload: Record<string, unknown> = {
        model,
        messages: conversationMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: options.maxTokens ?? 2048,
        temperature: options.temperature ?? 0.7,
      }

      if (systemMessages.length > 0) {
        payload.system = systemMessages.map((m) => m.content).join('\n\n')
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': options.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!response.ok) {
        const errJson = await response.json().catch(() => null)
        const errMsg = errJson?.error?.message || `Anthropic error: HTTP ${response.status}`
        throw new Error(errMsg)
      }

      const data = await response.json()
      const content =
        data.content
          ?.filter((block: { type: string }) => block.type === 'text')
          .map((block: { text: string }) => block.text)
          .join('') || ''

      return {
        content,
        model: data.model || model,
        usage: {
          promptTokens: data.usage?.input_tokens,
          completionTokens: data.usage?.output_tokens,
          totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        },
      }
    } catch (err) {
      clearTimeout(timeout)
      throw err instanceof Error ? err : new Error('Anthropic chat request failed')
    }
  }
}

