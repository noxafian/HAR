/**
 * src/services/scoring.service.ts
 * Server-side deterministic examination scoring engine.
 * Pure functions — no database dependencies.
 * Independently tested with adversarial inputs.
 */

export type QuestionType = 'MCQ' | 'MSQ' | 'NAT'

export interface MarkingScheme {
  positiveMarks: number
  negativeMarks: number   // for MCQ wrong; MSQ wrong = 0 by GATE rules
  natTolerance?: number   // absolute tolerance for NAT answers
}

export interface QuestionConfig {
  id: string
  type: QuestionType
  marking: MarkingScheme
  correctAnswer: string | string[] | number
}

export type StudentAnswer = string | string[] | number | null | undefined

export interface QuestionResult {
  questionId: string
  type: QuestionType
  studentAnswer: StudentAnswer
  correctAnswer: string | string[] | number
  outcome: 'correct' | 'incorrect' | 'unanswered'
  marksAwarded: number
  maxMarks: number
}

export interface ExamResult {
  totalMarks: number
  maxPossibleMarks: number
  correct: number
  incorrect: number
  unanswered: number
  accuracy: number          // 0–100
  questionResults: QuestionResult[]
}

/**
 * Score a single MCQ question.
 * - Correct option: +positiveMarks
 * - Wrong option:   -negativeMarks
 * - No answer:       0
 */
export function scoreMCQ(
  studentAnswer: StudentAnswer,
  correctAnswer: string,
  marking: MarkingScheme
): Pick<QuestionResult, 'outcome' | 'marksAwarded'> {
  if (studentAnswer === null || studentAnswer === undefined || studentAnswer === '') {
    return { outcome: 'unanswered', marksAwarded: 0 }
  }

  const answer = String(studentAnswer).trim().toUpperCase()
  const correct = String(correctAnswer).trim().toUpperCase()

  if (answer === correct) {
    return { outcome: 'correct', marksAwarded: marking.positiveMarks }
  }
  return { outcome: 'incorrect', marksAwarded: -Math.abs(marking.negativeMarks) }
}

/**
 * Score a single MSQ question.
 * GATE MSQ rules:
 * - All correct options selected (and no incorrect):  +positiveMarks
 * - Any incorrect option selected:                     0 (no negative marking for MSQ)
 * - No answer:                                          0
 */
export function scoreMSQ(
  studentAnswer: StudentAnswer,
  correctAnswer: string[],
  marking: MarkingScheme
): Pick<QuestionResult, 'outcome' | 'marksAwarded'> {
  if (!studentAnswer || (Array.isArray(studentAnswer) && studentAnswer.length === 0)) {
    return { outcome: 'unanswered', marksAwarded: 0 }
  }

  const selected: string[] = (Array.isArray(studentAnswer) ? studentAnswer : [String(studentAnswer)])
    .map(s => s.trim().toUpperCase())
  const correct = correctAnswer.map(c => c.trim().toUpperCase())

  const hasWrong = selected.some(s => !correct.includes(s))
  const hasAll = correct.every(c => selected.includes(c))

  if (!hasWrong && hasAll) {
    return { outcome: 'correct', marksAwarded: marking.positiveMarks }
  }
  if (hasWrong) {
    // Any wrong selection: 0 marks (no negative for MSQ per GATE rules)
    return { outcome: 'incorrect', marksAwarded: 0 }
  }
  // Partial correct without wrong — treated as incorrect (not fully answered)
  return { outcome: 'incorrect', marksAwarded: 0 }
}

/**
 * Score a single NAT question.
 * - Within tolerance:  +positiveMarks
 * - Outside tolerance:  0 (no negative marking for NAT per GATE rules)
 * - No answer:          0
 */
export function scoreNAT(
  studentAnswer: StudentAnswer,
  correctAnswer: number,
  marking: MarkingScheme
): Pick<QuestionResult, 'outcome' | 'marksAwarded'> {
  if (studentAnswer === null || studentAnswer === undefined || studentAnswer === '') {
    return { outcome: 'unanswered', marksAwarded: 0 }
  }

  const parsed = parseFloat(String(studentAnswer))
  if (isNaN(parsed)) {
    return { outcome: 'incorrect', marksAwarded: 0 }
  }

  const tolerance = marking.natTolerance ?? 0
  const diff = Math.abs(parsed - correctAnswer)

  if (diff <= tolerance) {
    return { outcome: 'correct', marksAwarded: marking.positiveMarks }
  }
  return { outcome: 'incorrect', marksAwarded: 0 }
}

/**
 * Score a complete examination submission.
 * Deterministic: same inputs always produce same output.
 */
export function scoreExam(
  questions: QuestionConfig[],
  studentAnswers: Record<string, StudentAnswer>
): ExamResult {
  let totalMarks = 0
  let correct = 0
  let incorrect = 0
  let unanswered = 0
  let maxPossibleMarks = 0
  const questionResults: QuestionResult[] = []

  for (const q of questions) {
    const studentAnswer = studentAnswers[q.id] ?? null
    maxPossibleMarks += q.marking.positiveMarks

    let result: Pick<QuestionResult, 'outcome' | 'marksAwarded'>

    if (q.type === 'MCQ') {
      result = scoreMCQ(studentAnswer, String(q.correctAnswer), q.marking)
    } else if (q.type === 'MSQ') {
      const correctArr = Array.isArray(q.correctAnswer)
        ? q.correctAnswer.map(String)
        : [String(q.correctAnswer)]
      result = scoreMSQ(studentAnswer, correctArr, q.marking)
    } else {
      result = scoreNAT(studentAnswer, Number(q.correctAnswer), q.marking)
    }

    totalMarks += result.marksAwarded
    if (result.outcome === 'correct') correct++
    else if (result.outcome === 'incorrect') incorrect++
    else unanswered++

    questionResults.push({
      questionId: q.id,
      type: q.type,
      studentAnswer,
      correctAnswer: q.correctAnswer,
      outcome: result.outcome,
      marksAwarded: result.marksAwarded,
      maxMarks: q.marking.positiveMarks,
    })
  }

  const accuracy = questions.length > 0
    ? Math.round((correct / questions.length) * 100)
    : 0

  return {
    totalMarks: Math.max(0, totalMarks), // floor at 0 for display (raw can be negative)
    maxPossibleMarks,
    correct,
    incorrect,
    unanswered,
    accuracy,
    questionResults,
  }
}
