import type { Result } from '../common/result.js';
import type { AiProviderUnavailableError, DomainError } from '../common/errors.js';
import type { ExtractedDesignAttributes } from '../domain/ai-designer/extracted-design-attributes.js';

export interface AiPromptRequest {
  readonly systemPrompt?: string;
  readonly userPrompt: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly timeoutMs?: number;
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

export interface AttributeExtractionRequest {
  readonly conversationHistory?: Array<{ role: 'USER' | 'ASSISTANT' | 'SYSTEM'; content: string }>;
  readonly latestUserMessage: string;
  readonly currentAttributes?: ExtractedDesignAttributes;
  readonly timeoutMs?: number;
}

export interface AttributeExtractionResponse {
  readonly assistantReply: string;
  readonly extractedAttributes: ExtractedDesignAttributes;
  readonly rawResponse?: string;
  readonly provider: string;
  readonly model: string;
}

/**
 * Pure Port for AI Operations.
 * Domain and Application layers interact with this abstraction only.
 */
export interface AiGatewayPort {
  executePrompt(
    request: AiPromptRequest
  ): Promise<Result<AiPromptResponse, AiProviderUnavailableError | DomainError>>;

  extractDesignAttributes?(
    request: AttributeExtractionRequest
  ): Promise<Result<AttributeExtractionResponse, AiProviderUnavailableError | DomainError>>;
}
