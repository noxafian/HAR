import type { SupabaseClient } from '@supabase/supabase-js'

/** Resolve canonical syllabus references. Unknown personal topic labels remain labels, not syllabus records. */
export async function resolveSubjectTopic(
  supabase: SupabaseClient,
  subjectName?: string,
  topicName?: string,
): Promise<{ subjectId: string | null; topicId: string | null; topicLabel: string | null; error?: string }> {
  let subjectId: string | null = null
  let topicId: string | null = null
  const topicLabel = topicName?.trim() || null

  if (subjectName) {
    const { data, error } = await supabase.from('subjects').select('id').eq('name', subjectName).maybeSingle()
    if (error) return { subjectId: null, topicId: null, topicLabel, error: 'Could not resolve subject' }
    if (!data) return { subjectId: null, topicId: null, topicLabel, error: `Unknown subject: ${subjectName}` }
    subjectId = data.id
  }

  if (topicLabel) {
    let query = supabase.from('topics').select('id,subject_id').eq('name', topicLabel).limit(2)
    if (subjectId) query = query.eq('subject_id', subjectId)
    const { data, error } = await query
    if (error) return { subjectId, topicId: null, topicLabel, error: 'Could not resolve topic' }
    if (data && data.length > 1) return { subjectId, topicId: null, topicLabel, error: 'Topic name is ambiguous; provide its subject' }
    if (data?.length === 1) {
      topicId = data[0].id
      if (!subjectId) subjectId = data[0].subject_id
    }
  }

  return { subjectId, topicId, topicLabel }
}
