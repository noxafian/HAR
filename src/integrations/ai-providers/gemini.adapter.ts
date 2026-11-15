/**
 * src/integrations/ai-providers/gemini.adapter.ts
 * Google Gemini Provider Adapter (REST / fetch-based)
 */

import type {
  IAIProvider,
  AIModelInfo,
  AIChatOptions,
  AIChatResponse,
  AIVerifyResult,
} from './interface'

export class GeminiAdapter implements IAIProvider {
  readonly id = 'gemini' as const
  readonly displayName = 'Google Gemini'

  readonly supportedModels: AIModelInfo[] = [
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Ultra Fast)', contextWindow: 1048576, default: true },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Deep Multimodal)', contextWindow: 2097152 },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Next-Gen)', contextWindow: 1048576 },
  ]

  getDefaultModel(): string {
    return 'gemini-1.5-flash'
  }

  validateKeyFormat(apiKey: string): boolean {
    return typeof apiKey === 'string' && apiKey.startsWith('AIzaSy') && apiKey.length >= 25
  }

  async verifyConnection(apiKey: string, modelId?: string): Promise<AIVerifyResult> {
    if (!this.validateKeyFormat(apiKey)) {
      return { valid: false, error: 'Invalid Gemini API key format. Key should start with "AIzaSy"' }
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'GET',
          signal: controller.signal,
        }
      )

      clearTimeout(timeout)

      if (response.status === 400 || response.status === 403) {
        return { valid: false, error: 'Invalid or unauthorized Gemini API key' }
      }

      if (!response.ok) {
        const text = await response.text()
        return { valid: false, error: `Gemini returned status ${response.status}: ${text}` }
      }

      return {
        valid: true,
        model: modelId || this.getDefaultModel(),
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed'
      return { valid: false, error: `Unable to reach Gemini: ${message}` }
    }
  }

  async chat(options: AIChatOptions): Promise<AIChatResponse> {
    const model = options.modelId || this.getDefaultModel()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 30000)

    try {
      // Split system message and dialogue contents
      const systemMessages = options.messages.filter((m) => m.role === 'system')
      const conversationMessages = options.messages.filter((m) => m.role !== 'system')

      const contents = conversationMessages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }))

      const payload: Record<string, unknown> = {
        contents,
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens ?? 2048,
        },
      }

      if (systemMessages.length > 0) {
        payload.systemInstruction = {
          parts: [{ text: systemMessages.map((m) => m.content).join('\n\n') }],
        }
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(options.apiKey)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }
      )

      clearTimeout(timeout)

      if (!response.ok) {
        const errJson = await response.json().catch(() => null)
        const errMsg = errJson?.error?.message || `Gemini error: HTTP ${response.status}`
        throw new Error(errMsg)
      }

      const data = await response.json()
      const candidate = data.candidates?.[0]
      const content = candidate?.content?.parts?.[0]?.text || ''

      return {
        content,
        model,
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount,
          completionTokens: data.usageMetadata?.candidatesTokenCount,
          totalTokens: data.usageMetadata?.totalTokenCount,
        },
      }
    } catch (err) {
      clearTimeout(timeout)
      throw err instanceof Error ? err : new Error('Gemini chat request failed')
    }
  }
}

