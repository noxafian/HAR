import type { AIProviderConfig, AIProvider, ConnectionStatus } from '@/types/ai-provider'

/**
 * AI provider connection service interface.
 *
 * SECURITY: This interface never handles raw API key material.
 * The backend (Phase B) receives, encrypts, and stores keys server-side only.
 * The frontend only sees ConnectionStatus — never key plaintext.
 */
export interface AIProviderService {
  /**
   * Initiates a connection. The actual key is transmitted directly to the server
   * and never stored client-side. Phase B implementation only.
   */
  initiateConnection(provider: AIProvider): Promise<void>
  getConnectionStatuses(): Promise<Record<AIProvider, ConnectionStatus>>
  getProviderConfig(provider: AIProvider): Promise<AIProviderConfig | null>
  disconnect(provider: AIProvider): Promise<void>
}
