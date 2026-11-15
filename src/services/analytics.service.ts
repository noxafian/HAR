import type { AnalyticsSummary } from '@/types/analytics'
import type { ExamPaper } from '@/types/exam'

/**
 * Analytics service interface.
 * All values derive from genuine recorded attempts — never fabricated.
 * Implementation: Phase B.
 */
export interface AnalyticsService {
  getSummary(userId: string): Promise<AnalyticsSummary>
  getSubjectAnalytics(userId: string, paper: ExamPaper): Promise<AnalyticsSummary['subjectProgress']>
}
