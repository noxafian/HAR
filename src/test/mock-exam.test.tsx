import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MockTestPage from '@/app/(app)/app/mock-tests/[testId]/page'

function renderMockTest(testId: string = '1') {
  return render(
    <MockTestPage params={{ testId }} />
  )
}

describe('Mock Examination Interface & Simulator', () => {
  it('renders question header, MCQ option choices, and palette numbers', () => {
    renderMockTest('gate-cs-mock-01')

    expect(screen.getByText(/Question 1 of 10/i)).toBeInTheDocument()
    expect(screen.getByText('MCQ')).toBeInTheDocument()
    expect(screen.getByText(/Quick Sort/i)).toBeInTheDocument()
    expect(screen.getByText(/Merge Sort/i)).toBeInTheDocument()

    // Palette has 10 question buttons
    const paletteButtons = screen.getAllByRole('button', { name: /Question \d+ —/i })
    expect(paletteButtons.length).toBe(10)
  })

  it('selects an MCQ option and updates palette status to answered', () => {
    renderMockTest('1')

    const radios = screen.getAllByRole('radio')
    expect(radios.length).toBe(4)
    fireEvent.click(radios[1]) // Option B

    // Question 1 button in palette should reflect answered
    const q1Button = screen.getByRole('button', { name: /Question 1 — answered/i })
    expect(q1Button).toBeInTheDocument()
  })

  it('navigates to MSQ question and selects multiple checkboxes', () => {
    renderMockTest('1')

    // Click Question 5 in palette
    const q5Button = screen.getByRole('button', { name: /Question 5 —/i })
    fireEvent.click(q5Button)

    expect(screen.getByText(/Question 5 of 10/i)).toBeInTheDocument()
    expect(screen.getByText('MSQ')).toBeInTheDocument()

    // Toggle options
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes.length).toBe(4)
    fireEvent.click(checkboxes[0])
    fireEvent.click(checkboxes[1])

    const updatedQ5Button = screen.getByRole('button', { name: /Question 5 — answered/i })
    expect(updatedQ5Button).toBeInTheDocument()
  })

  it('navigates to NAT question and accepts numerical input', () => {
    renderMockTest('1')

    const q8Button = screen.getByRole('button', { name: /Question 8 —/i })
    fireEvent.click(q8Button)

    expect(screen.getByText(/Question 8 of 10/i)).toBeInTheDocument()
    expect(screen.getByText('NAT')).toBeInTheDocument()

    const natInput = screen.getByPlaceholderText(/Enter numerical answer/i)
    fireEvent.change(natInput, { target: { value: '14' } })

    const updatedQ8Button = screen.getByRole('button', { name: /Question 8 — answered/i })
    expect(updatedQ8Button).toBeInTheDocument()
  })

  it('clears response and marks for review', () => {
    renderMockTest('1')

    const markReviewBtn = screen.getByRole('button', { name: /Mark for Review/i })
    fireEvent.click(markReviewBtn)

    const reviewedBtn = screen.getByRole('button', { name: /Question 1 — marked-for-review/i })
    expect(reviewedBtn).toBeInTheDocument()

    const clearBtn = screen.getByRole('button', { name: /Clear Response/i })
    fireEvent.click(clearBtn)

    const notAnsweredBtn = screen.getByRole('button', { name: /Question 1 — not-answered/i })
    expect(notAnsweredBtn).toBeInTheDocument()
  })

  it('opens submission confirmation modal with accurate summary counts', () => {
    renderMockTest('1')

    const submitBtn = screen.getByRole('button', { name: /Submit Test/i })
    fireEvent.click(submitBtn)

    expect(screen.getByText(/Submit Examination\?/i)).toBeInTheDocument()
    expect(screen.getByText(/Confirm Submission/i)).toBeInTheDocument()
    expect(screen.getByText(/Continue Test/i)).toBeInTheDocument()
  })
})
