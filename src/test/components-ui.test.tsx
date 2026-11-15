import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { EmptyState } from '@/components/ui/empty-state'
import { Progress } from '@/components/ui/progress'
import { CountdownWidget } from '@/components/dashboard/countdown-widget'
import { Library } from 'lucide-react'

describe('UI Primitives & Dashboard Widgets', () => {
  describe('Button', () => {
    it('renders with default variant and responds to click', () => {
      let clicked = false
      render(<Button onClick={() => { clicked = true }}>Click Me</Button>)
      const btn = screen.getByRole('button', { name: /click me/i })
      expect(btn).toBeInTheDocument()
      fireEvent.click(btn)
      expect(clicked).toBe(true)
    })

    it('renders disabled state correctly', () => {
      render(<Button disabled>Disabled Action</Button>)
      const btn = screen.getByRole('button', { name: /disabled action/i })
      expect(btn).toBeDisabled()
    })
  })

  describe('Badge', () => {
    it('renders different status variants', () => {
      const { rerender } = render(<Badge variant="success">Active</Badge>)
      expect(screen.getByText('Active')).toBeInTheDocument()

      rerender(<Badge variant="destructive">Overdue</Badge>)
      expect(screen.getByText('Overdue')).toBeInTheDocument()

      rerender(<Badge variant="warning">Unverified</Badge>)
      expect(screen.getByText('Unverified')).toBeInTheDocument()
    })
  })

  describe('Alert', () => {
    it('renders title and descriptive content', () => {
      render(
        <Alert variant="warning" title="Security Warning">
          Never expose raw API keys in client code.
        </Alert>
      )
      expect(screen.getByText('Security Warning')).toBeInTheDocument()
      expect(screen.getByText(/Never expose raw API keys/i)).toBeInTheDocument()
    })
  })

  describe('EmptyState', () => {
    it('renders title, description, and action button', () => {
      let actionFired = false
      render(
        <EmptyState
          icon={Library}
          title="No resources found"
          description="Upload your first syllabus notes."
          action={{
            label: 'Upload Note',
            onClick: () => { actionFired = true },
          }}
        />
      )
      expect(screen.getByText('No resources found')).toBeInTheDocument()
      expect(screen.getByText('Upload your first syllabus notes.')).toBeInTheDocument()
      const actionBtn = screen.getByRole('button', { name: /upload note/i })
      fireEvent.click(actionBtn)
      expect(actionFired).toBe(true)
    })
  })

  describe('Progress', () => {
    it('renders progress bar with correct aria attributes', () => {
      render(<Progress value={45} label="Topic completion" />)
      const progressBar = screen.getByRole('progressbar', { name: /topic completion/i })
      expect(progressBar).toBeInTheDocument()
      expect(progressBar).toHaveAttribute('aria-valuenow', '45')
    })
  })

  describe('CountdownWidget', () => {
    it('honestly displays "Official paper schedule not configured." when exam dates are null', () => {
      render(<CountdownWidget csExamDate={null} daExamDate={null} />)
      expect(screen.getAllByText(/Official paper schedule not configured/i).length).toBeGreaterThan(0)
    })
  })
})
