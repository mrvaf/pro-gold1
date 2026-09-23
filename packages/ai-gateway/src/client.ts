import type {
  AiGatewayPort,
  AiPromptRequest,
  AiPromptResponse,
  AiProviderUnavailableError,
  DomainError,
  Result,
} from '@v-gold/core';
import { UnavailableAiGatewayAdapter } from './adapters/unavailable-adapter.js';

export interface AiGatewayConfig {
  readonly adapter?: AiGatewayPort;
}

/**
 * AiGatewayClient routes requests to the configured provider adapter.
 * Defaults cleanly to UnavailableAiGatewayAdapter if no adapter is explicitly injected.
 */
export class AiGatewayClient implements AiGatewayPort {
  private readonly adapter: AiGatewayPort;

  constructor(config: AiGatewayConfig = {}) {
    this.adapter = config.adapter ?? new UnavailableAiGatewayAdapter();
  }

  async executePrompt(
    request: AiPromptRequest
  ): Promise<Result<AiPromptResponse, AiProviderUnavailableError | DomainError>> {
    return this.adapter.executePrompt(request);
  }
}
