/**
 * src/app/api/v1/study/topic-progress/route.ts
 * GET /api/v1/study/topic-progress - Get user's topic progress grouped by subject
 * POST /api/v1/study/topic-progress - Mark topic as complete/incomplete
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
import { createSupabaseClient } from '@/lib/server/supabase'
import { z } from 'zod'

const updateProgressSchema = z.object({
  subject_id: z.string().min(1),
  topic_id: z.string().min(1),
  completed: z.boolean()
})

interface TopicProgress {
  topic_id: string
  topic_name: string
  completed: boolean
  last_studied: string | null
}

interface SubjectProgress {
  subject_id: string
  subject_name: string
  exam: 'CS' | 'DA'
  topics: TopicProgress[]
  completed_count: number
  total_count: number
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message, 401).error,
        { status: 401 }
      )
    }
    if (!user.isActive) {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Approved membership required', 403).error,
        { status: 403 }
      )
    }

    const supabase = await createSupabaseClient()

    // Get all topics from gate_syllabus
    const { data: allTopics, error: topicsError } = await supabase
      .from('gate_syllabus')
      .select('subject_id, subject_name, exam, topic_name')
      .order('exam')
      .order('subject_id')
      .order('topic_name')

    if (topicsError) {
      console.error('[Topic Progress] Error fetching topics:', topicsError)
      return NextResponse.json(
        createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Failed to fetch topics', 500).error,
        { status: 500 }
      )
    }

    // Get user's progress
    const { data: userProgress, error: progressError } = await supabase
      .from('user_topic_progress')
      .select('subject_id, topic_id, completed, last_studied')
      .eq('user_id', user.id)

    if (progressError) {
      console.error('[Topic Progress] Error fetching user progress:', progressError)
      return NextResponse.json(
        createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Failed to fetch progress', 500).error,
        { status: 500 }
      )
    }

    // Build progress map
    const progressMap = new Map<string, { completed: boolean; last_studied: string | null }>()
    if (userProgress) {
      for (const progress of userProgress) {
        const key = `${progress.subject_id}:${progress.topic_id}`
        progressMap.set(key, {
          completed: progress.completed,
          last_studied: progress.last_studied
        })
      }
    }

    // Group by subject
    const subjectMap = new Map<string, SubjectProgress>()
    
    if (allTopics) {
      for (const topic of allTopics) {
        if (!subjectMap.has(topic.subject_id)) {
          subjectMap.set(topic.subject_id, {
            subject_id: topic.subject_id,
            subject_name: topic.subject_name,
            exam: topic.exam as 'CS' | 'DA',
            topics: [],
            completed_count: 0,
            total_count: 0
          })
        }

        const subject = subjectMap.get(topic.subject_id)!
        const progressKey = `${topic.subject_id}:${topic.topic_name}`
        const progress = progressMap.get(progressKey)

        subject.topics.push({
          topic_id: topic.topic_name,
          topic_name: topic.topic_name,
          completed: progress?.completed ?? false,
          last_studied: progress?.last_studied ?? null
        })

        subject.total_count++
        if (progress?.completed) {
          subject.completed_count++
        }
      }
    }

    const subjects = Array.from(subjectMap.values())

    return NextResponse.json(
      createApiResponse({ subjects }, 'Topic progress retrieved successfully'),
      { status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve progress'
    return NextResponse.json(
      createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, message, 500).error,
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message, 401).error,
        { status: 401 }
      )
    }
    if (!user.isActive) {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Approved membership required', 403).error,
        { status: 403 }
      )
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Request body must be valid JSON', 400).error,
        { status: 400 }
      )
    }

    const parseResult = updateProgressSchema.safeParse(body)
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0]
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.VALIDATION_FAILED.id,
          issue ? `${issue.path.join('.')}: ${issue.message}` : 'Validation failed',
          400
        ).error,
        { status: 400 }
      )
    }

    const { subject_id, topic_id, completed } = parseResult.data
    const supabase = await createSupabaseClient()

    // Upsert progress
    const { data, error } = await supabase
      .from('user_topic_progress')
      .upsert(
        {
          user_id: user.id,
          subject_id,
          topic_id,
          completed,
          last_studied: completed ? new Date().toISOString() : undefined,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id,subject_id,topic_id' }
      )
      .select()
      .single()

    if (error) {
      console.error('[Topic Progress] Error updating progress:', error)
      return NextResponse.json(
        createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Failed to update progress', 500).error,
        { status: 500 }
      )
    }

    return NextResponse.json(
      createApiResponse(data, `Topic marked as ${completed ? 'completed' : 'incomplete'}`),
      { status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update progress'
    return NextResponse.json(
      createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, message, 500).error,
      { status: 500 }
    )
  }
}
