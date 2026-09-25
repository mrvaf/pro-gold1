import {
  type AiGatewayPort,
  type AiPromptRequest,
  type AiPromptResponse,
  type AttributeExtractionRequest,
  type AttributeExtractionResponse,
  AiProviderUnavailableError,
  err,
  type Result,
} from '@v-gold/core';

/**
 * Unavailable AI Adapter.
 * Truthful fallback: Returns 503 AiProviderUnavailableError when no real AI provider is connected.
 * In accordance with Master Prompt: Never invent or pretend AI generation works when provider is unavailable.
 */
export class UnavailableAiGatewayAdapter implements AiGatewayPort {
  constructor(private readonly reason: string = 'No live AI provider configured in this environment.') {}

  async executePrompt(
    _request: AiPromptRequest
  ): Promise<Result<AiPromptResponse, AiProviderUnavailableError>> {
    return err(
      new AiProviderUnavailableError(this.reason, {
        provider: 'none',
        available: false,
      })
    );
  }

  async extractDesignAttributes(
    _request: AttributeExtractionRequest
  ): Promise<Result<AttributeExtractionResponse, AiProviderUnavailableError>> {
    return err(
      new AiProviderUnavailableError(this.reason, {
        provider: 'none',
        available: false,
      })
    );
  }
}
