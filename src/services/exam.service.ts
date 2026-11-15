import type { MockTest, TestAttempt } from '@/types/mock-test'
import type { ExamSchedule } from '@/types/exam'

/**
 * Examination service interface.
 * Mock test sessions are server-authoritative — timer and submission handled Phase B.
 */
export interface ExamService {
  getSchedules(): Promise<ExamSchedule[]>
  getMockTests(): Promise<MockTest[]>
  getMockTest(id: string): Promise<MockTest>
  startAttempt(testId: string): Promise<TestAttempt>
  /** Submit attempt — scoring done server-side. Never returns a score in Phase A. */
  submitAttempt(attemptId: string, answers: TestAttempt['answers']): Promise<void>
  getAttemptHistory(userId: string): Promise<TestAttempt[]>
}
