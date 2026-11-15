import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })

  const requestedPaper = (req.nextUrl.searchParams.get('paper') ?? 'CS').toUpperCase()
  if (requestedPaper !== 'CS' && requestedPaper !== 'DA' && requestedPaper !== 'GA') {
    return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'Paper must be CS, DA or GA'), { status: 400 })
  }

  const db = await createSupabaseClient()
  if (requestedPaper === 'GA') {
    const { data: subjects, error } = await db.from('subjects').select('id,name,display_order').eq('is_general_aptitude', true).order('display_order')
    if (error) {
      console.error('[syllabi.ga]', error.message)
      return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'General Aptitude catalogue could not be loaded'), { status: 500 })
    }
    const subjectIds = (subjects ?? []).map(subject => subject.id)
    const { data: topics, error: topicError } = subjectIds.length
      ? await db.from('topics').select('id,name,subject_id,display_order').in('subject_id', subjectIds).order('display_order')
      : { data: [], error: null }
    if (topicError) return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'General Aptitude topics could not be loaded'), { status: 500 })
    const items = (subjects ?? []).map(subject => ({ ...subject, topics: (topics ?? []).filter(topic => topic.subject_id === subject.id) }))
    return NextResponse.json(createApiResponse({ paper: 'GA', label: 'General Aptitude — shared section', year: 2027, sourceRef: null, sections: items, topicHierarchyAvailable: items.some(item => item.topics.length > 0) }, 'Shared General Aptitude catalogue retrieved'))
  }

  const { data: paper, error: paperError } = await db.from('exam_papers').select('id,code,label').eq('code', requestedPaper).maybeSingle()
  if (paperError || !paper) return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Exam paper catalogue could not be loaded'), { status: 500 })
  const { data: version, error: versionError } = await db.from('syllabus_versions').select('id,year,source_ref').eq('paper_id', paper.id).eq('is_current', true).maybeSingle()
  if (versionError) return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Syllabus version could not be loaded'), { status: 500 })
  if (!version) return NextResponse.json(createApiResponse({ paper: paper.code, label: paper.label, year: null, sourceRef: null, sections: [], topicHierarchyAvailable: false }, 'No current syllabus version is configured'))

  const { data: links, error: linksError } = await db.from('syllabus_subjects').select('display_order,subjects(id,name,is_general_aptitude,display_order)').eq('syllabus_version_id', version.id).order('display_order')
  if (linksError) return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Syllabus subject links could not be loaded'), { status: 500 })
  const subjects = (links ?? []).map(link => Array.isArray(link.subjects) ? link.subjects[0] : link.subjects).filter((subject): subject is { id: string; name: string; is_general_aptitude: boolean; display_order: number } => Boolean(subject))
  const subjectIds = subjects.map(subject => subject.id)
  const { data: topics, error: topicsError } = subjectIds.length
    ? await db.from('topics').select('id,name,subject_id,display_order').in('subject_id', subjectIds).order('display_order')
    : { data: [], error: null }
  if (topicsError) return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Syllabus topics could not be loaded'), { status: 500 })
  const sections = subjects.map(subject => ({ ...subject, topics: (topics ?? []).filter(topic => topic.subject_id === subject.id) }))
  return NextResponse.json(createApiResponse({
    paper: paper.code,
    label: paper.label,
    year: version.year,
    sourceRef: version.source_ref,
    sections,
    topicHierarchyAvailable: sections.some(section => section.topics.length > 0),
  }, 'Syllabus catalogue retrieved from the database'))
}
