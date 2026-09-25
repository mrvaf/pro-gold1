import type {
  AiGatewayPort,
  AiPromptRequest,
  AiPromptResponse,
  AiProviderUnavailableError,
  AttributeExtractionRequest,
  AttributeExtractionResponse,
  DomainError,
  Result,
} from '@v-gold/core';
import { err, AiTimeoutError } from '@v-gold/core';
import { UnavailableAiGatewayAdapter } from './adapters/unavailable-adapter.js';

export interface AiGatewayConfig {
  readonly adapter?: AiGatewayPort;
  readonly defaultTimeoutMs?: number;
}

/**
 * AiGatewayClient routes requests to the configured provider adapter.
 * Defaults cleanly to UnavailableAiGatewayAdapter if no adapter is explicitly injected.
 * Enforces timeout handling and fallback boundaries.
 */
export class AiGatewayClient implements AiGatewayPort {
  private readonly adapter: AiGatewayPort;
  private readonly defaultTimeoutMs: number;

  constructor(config: AiGatewayConfig = {}) {
    this.adapter = config.adapter ?? new UnavailableAiGatewayAdapter();
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 10_000;
  }

  async executePrompt(
    request: AiPromptRequest
  ): Promise<Result<AiPromptResponse, AiProviderUnavailableError | DomainError>> {
    const timeoutMs = request.timeoutMs ?? this.defaultTimeoutMs;
    return this.withTimeout(
      () => this.adapter.executePrompt(request),
      timeoutMs,
      'Prompt execution timed out'
    );
  }

  async extractDesignAttributes(
    request: AttributeExtractionRequest
  ): Promise<Result<AttributeExtractionResponse, AiProviderUnavailableError | DomainError>> {
    const timeoutMs = request.timeoutMs ?? this.defaultTimeoutMs;

    if (!this.adapter.extractDesignAttributes) {
      return this.withTimeout(
        () =>
          new UnavailableAiGatewayAdapter(
            'Adapter does not support attribute extraction.'
          ).extractDesignAttributes(request),
        timeoutMs,
        'Attribute extraction timed out'
      );
    }

    return this.withTimeout(
      () => this.adapter.extractDesignAttributes!(request),
      timeoutMs,
      'Attribute extraction timed out'
    );
  }

  private async withTimeout<T>(
    operation: () => Promise<Result<T, AiProviderUnavailableError | DomainError>>,
    timeoutMs: number,
    timeoutMessage: string
  ): Promise<Result<T, AiProviderUnavailableError | DomainError>> {
    let timer: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<Result<T, AiTimeoutError>>((resolve) => {
      timer = setTimeout(() => {
        resolve(err(new AiTimeoutError(`${timeoutMessage} after ${timeoutMs}ms.`)));
      }, timeoutMs);
    });

    try {
      const res = await Promise.race([operation(), timeoutPromise]);
      return res;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
