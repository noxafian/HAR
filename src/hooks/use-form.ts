'use client'

import { useState, useCallback } from 'react'
import type * as z from 'zod'

type ZodSchema<T> = z.ZodType<T>

interface UseFormOptions<T> {
  initialValues: T
  schema: ZodSchema<T>
  onSubmit: (values: T) => Promise<void>
}

type Errors<T> = Partial<Record<keyof T, string>>

export function useForm<T extends Record<string, unknown>>({
  initialValues,
  schema,
  onSubmit,
}: UseFormOptions<T>) {
  const [values, setValues] = useState<T>(initialValues)
  const [errors, setErrors] = useState<Errors<T>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = useCallback(
    (field: keyof T) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setValues((prev) => ({ ...prev, [field]: e.target.value }))
        setErrors((prev) => ({ ...prev, [field]: undefined }))
      },
    []
  )

  const setFieldValue = useCallback((field: keyof T, value: unknown) => {
    setValues((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const result = schema.safeParse(values)
      if (!result.success) {
        const fieldErrors: Errors<T> = {}
        for (const issue of result.error.issues) {
          const path = issue.path[0] as keyof T
          if (path && !fieldErrors[path]) fieldErrors[path] = issue.message
        }
        setErrors(fieldErrors)
        return
      }
      setIsSubmitting(true)
      try {
        await onSubmit(result.data as T)
      } finally {
        setIsSubmitting(false)
      }
    },
    [schema, values, onSubmit]
  )

  const reset = useCallback(() => {
    setValues(initialValues)
    setErrors({})
  }, [initialValues])

  return { values, errors, isSubmitting, handleChange, setFieldValue, handleSubmit, reset }
}
