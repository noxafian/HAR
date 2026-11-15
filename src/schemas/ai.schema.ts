/**
 * src/schemas/ai.schema.ts
 * Validation schemas for AI Provider Integration and Chat APIs
 */

import { z } from 'zod'

export const SUPPORTED_AI_PROVIDERS = [
  'openai',
  'gemini',
  'groq',
  'openrouter',
  'anthropic',
] as const

export type SupportedAIProvider = (typeof SUPPORTED_AI_PROVIDERS)[number]

export const connectProviderSchema = z.object({
  provider: z.enum(SUPPORTED_AI_PROVIDERS),
  apiKey: z
    .string()
    .trim()
    .min(10, { message: 'API key must be at least 10 characters' })
    .max(512, { message: 'API key must not exceed 512 characters' }),
  modelId: z.string().trim().max(128).optional(),
})

export type ConnectProviderInput = z.infer<typeof connectProviderSchema>

export const rotateKeySchema = z.object({
  apiKey: z
    .string()
    .trim()
    .min(10, { message: 'API key must be at least 10 characters' })
    .max(512, { message: 'API key must not exceed 512 characters' }),
  modelId: z.string().trim().max(128).optional(),
})

export type RotateKeyInput = z.infer<typeof rotateKeySchema>

export const updateConnectionSchema = z.object({
  modelId: z.string().trim().max(128).optional(),
  status: z.enum(['active', 'disabled']).optional(),
})

export type UpdateConnectionInput = z.infer<typeof updateConnectionSchema>

export const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z
    .string()
    .trim()
    .min(1, { message: 'Message content cannot be empty' })
    .max(32000, { message: 'Message content cannot exceed 32,000 characters' }),
})

export type ChatMessageInput = z.infer<typeof chatMessageSchema>

export const chatRequestSchema = z
  .object({
    connectionId: z.string().uuid({ message: 'Invalid connection ID format' }).optional(),
    provider: z.enum(SUPPORTED_AI_PROVIDERS).optional(),
    messages: z
      .array(chatMessageSchema)
      .min(1, { message: 'At least one message is required' })
      .max(50, { message: 'Conversation history cannot exceed 50 messages' }),
    stream: z.boolean().optional().default(false),
    temperature: z.number().min(0).max(2).optional().default(0.7),
    maxTokens: z.number().int().positive().max(8192).optional().default(2048),
  })
  .refine((data) => data.connectionId !== undefined || data.provider !== undefined, {
    message: 'Either connectionId or provider must be provided',
    path: ['connectionId'],
  })
  .refine((data) => data.messages.reduce((total, message) => total + message.content.length, 0) <= 100_000, {
    message: 'Combined conversation content cannot exceed 100,000 characters',
    path: ['messages'],
  })

export type ChatRequestInput = z.infer<typeof chatRequestSchema>

export const verifyConnectionSchema = z.object({
  modelId: z.string().trim().max(128).optional(),
})

export type VerifyConnectionInput = z.infer<typeof verifyConnectionSchema>
