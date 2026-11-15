/**
 * GET /api/v1/questions/[questionId]/explain
 * Returns a step-by-step explanation for a question.
 * Uses stored explanation if available; falls back to Groq API otherwise.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

type Ctx = { params: Promise<{ questionId: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message),
      { status: 401 },
    )
  }

  const { questionId } = await params
  if (!UUID.test(questionId)) {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid question ID'),
      { status: 400 },
    )
  }

  const supabase = await createSupabaseClient()

  // Fetch question
  const { data: question, error: questionError } = await supabase
    .from('questions')
    .select('id,prompt,options,category,is_verified')
    .eq('id', questionId)
    .eq('is_deleted', false)
    .eq('is_verified', true)
    .maybeSingle()

  if (questionError) {
    console.error('[questions.explain]', questionError.message)
    return NextResponse.json(
      createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not retrieve question'),
      { status: 500 },
    )
  }

  if (!question) {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.QUESTION_NOT_FOUND.id, 'Question not found'),
      { status: 404 },
    )
  }

  // Try to get stored solution + answer via the same RPC used by the question detail route
  let storedSolution: string | null = null
  let correctAnswer: string | string[] | number | null = null

  if (question.category === 'official-pyq' || user.role === 'owner') {
    const { data: keyData, error: solutionError } = await supabase.rpc('get_question_solution', {
      p_question_id: questionId,
    })
    if (!solutionError && keyData) {
      const payload = keyData as { correctAnswer?: string | string[] | number | null; solution?: string | null } | null
      storedSolution = payload?.solution ?? null
      correctAnswer = payload?.correctAnswer ?? null
    }
  }

  // If a stored explanation exists, return it directly
  if (storedSolution) {
    return NextResponse.json(
      createApiResponse({ explanation: storedSolution, source: 'stored' as const }, 'Explanation retrieved'),
    )
  }

  // No stored explanation — try Groq API as fallback
  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) {
    return NextResponse.json(
      createApiResponse(
        { explanation: 'No explanation is available for this question.', source: 'stored' as const },
        'No explanation available',
      ),
    )
  }

  const optionsText = Array.isArray(question.options) && question.options.length > 0
    ? (question.options as string[]).map((opt, i) => `(${String.fromCharCode(65 + i)}) ${opt}`).join(', ')
    : 'No options (numerical answer type)'

  const answerText = correctAnswer !== null && correctAnswer !== undefined
    ? Array.isArray(correctAnswer) ? correctAnswer.join(', ') : String(correctAnswer)
    : 'Not available'

  const systemMessage = 'You are a GATE exam expert. Explain questions step by step, covering the concept tested and why the correct answer is right. Be concise and use numbered steps.'
  const userMessage = [
    'Explain this GATE question step by step:',
    `Question: ${question.prompt}`,
    `Options: ${optionsText}`,
    `Correct Answer: ${answerText}`,
  ].join('\n\n')

  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
    })

    if (!groqResponse.ok) {
      const errText = await groqResponse.text().catch(() => 'unknown error')
      console.error('[questions.explain.groq]', groqResponse.status, errText)
      return NextResponse.json(
        createApiResponse(
          { explanation: 'AI explanation is temporarily unavailable.', source: 'stored' as const },
          'AI unavailable',
        ),
      )
    }

    const groqData = await groqResponse.json() as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const aiExplanation = groqData.choices?.[0]?.message?.content?.trim() ?? 'No explanation generated.'

    return NextResponse.json(
      createApiResponse({ explanation: aiExplanation, source: 'ai' as const }, 'AI explanation generated'),
    )
  } catch (err) {
    console.error('[questions.explain.groq.fetch]', err instanceof Error ? err.message : err)
    return NextResponse.json(
      createApiResponse(
        { explanation: 'AI explanation is temporarily unavailable.', source: 'stored' as const },
        'AI unavailable',
      ),
    )
  }
}
