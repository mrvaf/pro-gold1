import type { Result } from '../common/result.js';
import type { AiProviderUnavailableError, DomainError } from '../common/errors.js';

export interface AiPromptRequest {
  readonly systemPrompt?: string;
  readonly userPrompt: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
}

export interface AiPromptResponse {
  readonly content: string;
  readonly provider: string;
  readonly model: string;
  readonly usage?: {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
  };
}

/**
 * Pure Port for AI Operations.
 * Domain and Application layers interact with this abstraction only.
 */
export interface AiGatewayPort {
  executePrompt(
    request: AiPromptRequest
  ): Promise<Result<AiPromptResponse, AiProviderUnavailableError | DomainError>>;
}
