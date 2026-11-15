import type { Subject, Topic, TopicProgress, SyllabusVersion } from '@/types/syllabus'
import type { ExamPaper } from '@/types/exam'

/**
 * Syllabus service interface.
 * Syllabus data verified against official GATE 2027 schedule in Phase B.
 */
export interface SyllabusService {
  getVersion(paper: ExamPaper): Promise<SyllabusVersion | null>
  getSubjects(paper: ExamPaper): Promise<Subject[]>
  getTopics(subjectId: string): Promise<Topic[]>
  getTopicProgress(userId: string, paper: ExamPaper): Promise<TopicProgress[]>
  updateTopicProgress(userId: string, topicId: string, percent: number): Promise<void>
}
