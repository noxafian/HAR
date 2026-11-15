/**
 * Scoring engine unit tests — deterministic, no DB needed
 */
import { describe, it, expect } from 'vitest'
import {
  scoreMCQ,
  scoreMSQ,
  scoreNAT,
  scoreExam,
  type QuestionConfig,
} from '@/services/scoring.service'

const mcqMarking = { positiveMarks: 1, negativeMarks: 0.33 }
const mcq2Marking = { positiveMarks: 2, negativeMarks: 0.66 }
const msqMarking = { positiveMarks: 2, negativeMarks: 0 }
const natMarking = { positiveMarks: 1, negativeMarks: 0, natTolerance: 0 }
const nat2Marking = { positiveMarks: 2, negativeMarks: 0, natTolerance: 0.1 }

describe('MCQ scoring', () => {
  it('awards positive marks for correct answer', () => {
    expect(scoreMCQ('A', 'A', mcqMarking)).toEqual({ outcome: 'correct', marksAwarded: 1 })
  })
  it('applies negative marks for wrong answer', () => {
    const r = scoreMCQ('B', 'A', mcqMarking)
    expect(r.outcome).toBe('incorrect')
    expect(r.marksAwarded).toBe(-0.33)
  })
  it('returns 0 for unanswered (null)', () => {
    expect(scoreMCQ(null, 'A', mcqMarking)).toEqual({ outcome: 'unanswered', marksAwarded: 0 })
  })
  it('returns 0 for unanswered (empty string)', () => {
    expect(scoreMCQ('', 'A', mcqMarking)).toEqual({ outcome: 'unanswered', marksAwarded: 0 })
  })
  it('is case-insensitive', () => {
    expect(scoreMCQ('a', 'A', mcqMarking)).toEqual({ outcome: 'correct', marksAwarded: 1 })
  })
  it('handles 2-mark MCQ negative correctly', () => {
    const r = scoreMCQ('C', 'A', mcq2Marking)
    expect(r.marksAwarded).toBe(-0.66)
  })
})

describe('MSQ scoring', () => {
  it('awards marks when all correct options are selected', () => {
    expect(scoreMSQ(['A', 'C'], ['A', 'C'], msqMarking)).toEqual({ outcome: 'correct', marksAwarded: 2 })
  })
  it('returns 0 (not negative) when any wrong option selected', () => {
    const r = scoreMSQ(['A', 'B'], ['A', 'C'], msqMarking)
    expect(r.outcome).toBe('incorrect')
    expect(r.marksAwarded).toBe(0) // NO negative marking for MSQ
  })
  it('returns 0 for partial correct selection without wrong', () => {
    const r = scoreMSQ(['A'], ['A', 'C'], msqMarking)
    expect(r.outcome).toBe('incorrect')
    expect(r.marksAwarded).toBe(0)
  })
  it('returns 0 for unanswered (empty array)', () => {
    expect(scoreMSQ([], ['A', 'C'], msqMarking)).toEqual({ outcome: 'unanswered', marksAwarded: 0 })
  })
  it('returns 0 for unanswered (null)', () => {
    expect(scoreMSQ(null, ['A', 'C'], msqMarking)).toEqual({ outcome: 'unanswered', marksAwarded: 0 })
  })
})

describe('NAT scoring', () => {
  it('awards marks for exact correct answer', () => {
    expect(scoreNAT('14', 14, natMarking)).toEqual({ outcome: 'correct', marksAwarded: 1 })
  })
  it('returns 0 (not negative) for wrong answer', () => {
    const r = scoreNAT('10', 14, natMarking)
    expect(r.outcome).toBe('incorrect')
    expect(r.marksAwarded).toBe(0) // NO negative for NAT
  })
  it('handles tolerance correctly — within range is correct', () => {
    expect(scoreNAT('3.14', 3.14159, nat2Marking)).toEqual({ outcome: 'correct', marksAwarded: 2 })
  })
  it('handles tolerance correctly — outside range is incorrect', () => {
    const r = scoreNAT('3.0', 3.14159, nat2Marking)
    expect(r.outcome).toBe('incorrect')
    expect(r.marksAwarded).toBe(0)
  })
  it('returns 0 for unanswered (null)', () => {
    expect(scoreNAT(null, 14, natMarking)).toEqual({ outcome: 'unanswered', marksAwarded: 0 })
  })
  it('returns 0 for non-numeric input', () => {
    const r = scoreNAT('abc', 14, natMarking)
    expect(r.outcome).toBe('incorrect')
    expect(r.marksAwarded).toBe(0)
  })
  it('handles decimal answers', () => {
    expect(scoreNAT('2.5', 2.5, natMarking)).toEqual({ outcome: 'correct', marksAwarded: 1 })
  })
})

describe('Full exam scoring', () => {
  const questions: QuestionConfig[] = [
    { id: 'q1', type: 'MCQ', marking: mcqMarking, correctAnswer: 'A' },
    { id: 'q2', type: 'MCQ', marking: mcqMarking, correctAnswer: 'B' },
    { id: 'q3', type: 'MSQ', marking: msqMarking, correctAnswer: ['A', 'C'] },
    { id: 'q4', type: 'NAT', marking: natMarking, correctAnswer: 14 },
    { id: 'q5', type: 'MCQ', marking: mcqMarking, correctAnswer: 'D' },
  ]

  it('calculates correct counts', () => {
    const result = scoreExam(questions, { q1: 'A', q2: 'C', q3: ['A', 'C'], q4: '14', q5: null })
    expect(result.correct).toBe(3)    // q1, q3, q4
    expect(result.incorrect).toBe(1)  // q2 wrong
    expect(result.unanswered).toBe(1) // q5 null
  })

  it('totalMarks can never go below 0', () => {
    // All wrong MCQs
    const result = scoreExam(questions, { q1: 'B', q2: 'A', q3: ['B'], q4: '0', q5: 'A' })
    expect(result.totalMarks).toBeGreaterThanOrEqual(0)
  })

  it('produces 100% accuracy when all correct', () => {
    const result = scoreExam(questions, { q1: 'A', q2: 'B', q3: ['A', 'C'], q4: '14', q5: 'D' })
    expect(result.correct).toBe(5)
    expect(result.accuracy).toBe(100)
  })

  it('is deterministic — same inputs always produce same output', () => {
    const answers = { q1: 'A', q2: 'B', q3: ['A', 'C'], q4: '14', q5: null }
    const r1 = scoreExam(questions, answers)
    const r2 = scoreExam(questions, answers)
    expect(r1).toEqual(r2)
  })
})
