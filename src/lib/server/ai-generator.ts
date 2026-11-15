/**
 * Server-side AI content generation with Groq → OpenRouter → Gemini fallback
 * Generates flashcards and quiz questions for GATE topics
 */

export interface Flashcard {
  id: string
  front: string
  back: string
  topic: string
  subject_id: string
}

export interface QuizQuestion {
  id: string
  question: string
  options: { A: string; B: string; C: string; D: string }
  correct_answer: 'A' | 'B' | 'C' | 'D'
  explanation: string
  topic: string
  subject_id: string
}

export interface GenerateResult<T> {
  items: T[]
  provider: 'groq' | 'openrouter' | 'gemini'
  model: string
}

type AIProvider = 'groq' | 'openrouter' | 'gemini'

interface ProviderConfig {
  name: AIProvider
  url: string
  model: string
  getHeaders: (apiKey: string) => Record<string, string>
  formatRequest: (prompt: string) => unknown
  parseResponse: (data: unknown) => string
}

const PROVIDERS: ProviderConfig[] = [
  {
    name: 'groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    getHeaders: (apiKey: string) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }),
    formatRequest: (prompt: string) => ({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are an expert GATE exam tutor. Return only valid JSON arrays with no markdown or extra text.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7
    }),
    parseResponse: (data: unknown) => {
      const response = data as { choices?: Array<{ message?: { content?: string } }> }
      return response.choices?.[0]?.message?.content ?? ''
    }
  },
  {
    name: 'openrouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'meta-llama/llama-3.1-8b-instruct:free',
    getHeaders: (apiKey: string) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://studyhub.local'
    }),
    formatRequest: (prompt: string) => ({
      model: 'meta-llama/llama-3.1-8b-instruct:free',
      messages: [
        { role: 'system', content: 'You are an expert GATE exam tutor. Return only valid JSON arrays with no markdown or extra text.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    }),
    parseResponse: (data: unknown) => {
      const response = data as { choices?: Array<{ message?: { content?: string } }> }
      return response.choices?.[0]?.message?.content ?? ''
    }
  },
  {
    name: 'gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
    model: 'gemini-1.5-flash',
    getHeaders: () => ({
      'Content-Type': 'application/json'
    }),
    formatRequest: (prompt: string) => ({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.7 }
    }),
    parseResponse: (data: unknown) => {
      const response = data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
      return response.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    }
  }
]

function getApiKey(provider: AIProvider): string | null {
  const envKey = provider === 'groq' ? 'GROQ_API_KEY' 
    : provider === 'openrouter' ? 'OPENROUTER_API_KEY' 
    : 'GEMINI_API_KEY'
  return process.env[envKey] || null
}

async function tryProvider<T>(
  provider: ProviderConfig,
  prompt: string,
  parser: (text: string) => T[],
  errors: string[]
): Promise<GenerateResult<T> | null> {
  const apiKey = getApiKey(provider.name)
  if (!apiKey) {
    const reason = `${provider.name}: API key not configured`
    console.log(`[AI] ${reason}`)
    errors.push(reason)
    return null
  }

  try {
    const url = provider.name === 'gemini' 
      ? `${provider.url}?key=${apiKey}` 
      : provider.url

    const response = await fetch(url, {
      method: 'POST',
      headers: provider.getHeaders(apiKey),
      body: JSON.stringify(provider.formatRequest(prompt))
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      let friendlyReason: string
      if (response.status === 429) {
        friendlyReason = `${provider.name}: Rate limit reached (${response.status}) — try again later`
      } else if (response.status === 401 || response.status === 403) {
        friendlyReason = `${provider.name}: Invalid or expired API key (${response.status})`
      } else {
        friendlyReason = `${provider.name}: HTTP ${response.status} — ${errorText.slice(0, 120)}`
      }
      console.log(`[AI] ${friendlyReason}`)
      errors.push(friendlyReason)
      return null
    }

    const data = await response.json()
    const content = provider.parseResponse(data)
    
    if (!content) {
      const reason = `${provider.name}: Empty response from model`
      console.log(`[AI] ${reason}`)
      errors.push(reason)
      return null
    }

    // Parse the content - handle both direct array and wrapped object
    let parsed: T[]
    try {
      const jsonData = JSON.parse(content)
      // If the response is wrapped in an object with an array property, extract it
      if (jsonData && typeof jsonData === 'object' && !Array.isArray(jsonData)) {
        const keys = Object.keys(jsonData)
        const arrayKey = keys.find(k => Array.isArray(jsonData[k as keyof typeof jsonData]))
        parsed = arrayKey ? (jsonData[arrayKey as keyof typeof jsonData] as T[]) : []
      } else if (Array.isArray(jsonData)) {
        parsed = jsonData as T[]
      } else {
        parsed = []
      }
    } catch (parseError) {
      const reason = `${provider.name}: JSON parse error — ${parseError instanceof Error ? parseError.message : 'malformed response'}`
      console.log(`[AI] ${reason}`)
      errors.push(reason)
      return null
    }

    const items = parser(JSON.stringify(parsed))
    
    if (items.length === 0) {
      const reason = `${provider.name}: Model returned no valid items (check prompt or model capability)`
      console.log(`[AI] ${reason}`)
      errors.push(reason)
      return null
    }

    console.log(`[AI] ${provider.name} success: generated ${items.length} items`)
    return { items, provider: provider.name, model: provider.model }

  } catch (error) {
    const reason = `${provider.name}: Network or runtime error — ${error instanceof Error ? error.message : 'Unknown error'}`
    console.log(`[AI] ${reason}`)
    errors.push(reason)
    return null
  }
}

export async function generateFlashcards(
  topic: string,
  subjectName: string,
  subject_id: string,
  count: number = 5
): Promise<GenerateResult<Flashcard>> {
  const prompt = `Generate exactly ${count} flashcards for GATE exam preparation on the topic "${topic}" in the subject "${subjectName}". 
Return a JSON array where each flashcard has "front" (the concept or question to test) and "back" (the answer or explanation).
Format: [{"front": "...", "back": "..."}]
Make them challenging and exam-focused. Return ONLY the JSON array with no markdown formatting.`

  const parser = (text: string): Flashcard[] => {
    try {
      const data = JSON.parse(text)
      if (!Array.isArray(data)) return []
      
      return data
        .filter((item: unknown) => {
          const obj = item as Record<string, unknown>
          return obj && typeof obj.front === 'string' && typeof obj.back === 'string'
        })
        .map((item: unknown, index: number) => {
          const obj = item as { front: string; back: string }
          return {
            id: crypto.randomUUID(),
            front: obj.front,
            back: obj.back,
            topic,
            subject_id
          }
        })
    } catch {
      return []
    }
  }

  // Try each provider in order, accumulating error reasons
  const errors: string[] = []
  for (const provider of PROVIDERS) {
    const result = await tryProvider(provider, prompt, parser, errors)
    if (result) return result
  }

  throw new Error(`All AI providers failed:\n${errors.map(e => `• ${e}`).join('\n')}`)
}

export async function generateQuiz(
  topic: string,
  subjectName: string,
  subject_id: string,
  count: number = 5
): Promise<GenerateResult<QuizQuestion>> {
  const prompt = `Generate exactly ${count} multiple-choice questions for GATE exam preparation on the topic "${topic}" in the subject "${subjectName}".
Return a JSON array where each question has: "question" (the question text), "options" (object with keys A, B, C, D), "correct_answer" (one of "A", "B", "C", or "D"), and "explanation" (why the answer is correct).
Format: [{"question": "...", "options": {"A": "...", "B": "...", "C": "...", "D": "..."}, "correct_answer": "A", "explanation": "..."}]
Make them challenging and exam-focused. Return ONLY the JSON array with no markdown formatting.`

  const parser = (text: string): QuizQuestion[] => {
    try {
      const data = JSON.parse(text)
      if (!Array.isArray(data)) return []
      
      return data
        .filter((item: unknown) => {
          const obj = item as Record<string, unknown>
          return obj 
            && typeof obj.question === 'string'
            && obj.options && typeof obj.options === 'object'
            && typeof obj.correct_answer === 'string'
            && ['A', 'B', 'C', 'D'].includes(obj.correct_answer as string)
            && typeof obj.explanation === 'string'
        })
        .map((item: unknown) => {
          const obj = item as {
            question: string
            options: { A: string; B: string; C: string; D: string }
            correct_answer: 'A' | 'B' | 'C' | 'D'
            explanation: string
          }
          return {
            id: crypto.randomUUID(),
            question: obj.question,
            options: obj.options,
            correct_answer: obj.correct_answer,
            explanation: obj.explanation,
            topic,
            subject_id
          }
        })
    } catch {
      return []
    }
  }

  // Try each provider in order, accumulating error reasons
  const errors: string[] = []
  for (const provider of PROVIDERS) {
    const result = await tryProvider(provider, prompt, parser, errors)
    if (result) return result
  }

  throw new Error(`All AI providers failed:\n${errors.map(e => `• ${e}`).join('\n')}`)
}
