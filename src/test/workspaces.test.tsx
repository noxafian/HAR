import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CS_SUBJECTS, DA_SUBJECTS, GA_SUBJECTS } from '@/lib/constants'

// ExamWorkspace fetches from the API internally, so we test the constants
// that drive the syllabus display instead of rendering the full component.

describe('GATE Subject Catalogues', () => {
  it('CS catalogue contains 11 core subjects', () => {
    expect(CS_SUBJECTS.length).toBe(11)
    const names = CS_SUBJECTS.map(s => s.name)
    expect(names).toContain('Engineering Mathematics')
    expect(names).toContain('Discrete Mathematics')
    expect(names).toContain('Digital Logic')
    expect(names).toContain('Computer Organization and Architecture')
    expect(names).toContain('Programming and Data Structures')
    expect(names).toContain('Algorithms')
    expect(names).toContain('Theory of Computation')
    expect(names).toContain('Compiler Design')
    expect(names).toContain('Operating Systems')
    expect(names).toContain('Database Management Systems')
    expect(names).toContain('Computer Networks')
  })

  it('DA catalogue contains 7 core subjects', () => {
    expect(DA_SUBJECTS.length).toBe(7)
    const names = DA_SUBJECTS.map(s => s.name)
    expect(names).toContain('Probability and Statistics')
    expect(names).toContain('Linear Algebra')
    expect(names).toContain('Calculus and Optimization')
    expect(names).toContain('Programming, Data Structures and Algorithms')
    expect(names).toContain('Database Management and Warehousing')
    expect(names).toContain('Machine Learning')
    expect(names).toContain('Artificial Intelligence')
  })

  it('GA catalogue contains Verbal Ability and Quantitative Aptitude', () => {
    const names = GA_SUBJECTS.map(s => s.name)
    expect(names).toContain('Verbal Ability')
    expect(names).toContain('Quantitative Aptitude')
  })

  it('CS and DA subject lists are independent with no overlap', () => {
    const csNames = new Set(CS_SUBJECTS.map(s => s.name))
    const daNames = DA_SUBJECTS.map(s => s.name)
    const overlap = daNames.filter(name => csNames.has(name))
    expect(overlap).toHaveLength(0)
  })
})
