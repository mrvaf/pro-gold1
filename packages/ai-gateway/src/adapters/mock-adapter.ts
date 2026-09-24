import {
  type AiGatewayPort,
  type AiPromptRequest,
  type AiPromptResponse,
  ok,
  type Result,
} from '@v-gold/core';

export interface MockAiGatewayOptions {
  readonly defaultResponse?: string;
  readonly modelName?: string;
}

/**
 * Mock AI Adapter for deterministic automated unit & integration testing.
 */
export class MockAiGatewayAdapter implements AiGatewayPort {
  private readonly defaultResponse: string;
  private readonly modelName: string;
  public lastRequest: AiPromptRequest | null = null;
  public callCount = 0;

  constructor(options: MockAiGatewayOptions = {}) {
    this.defaultResponse = options.defaultResponse ?? 'MOCK_AI_RESPONSE';
    this.modelName = options.modelName ?? 'mock-model-v1';
  }

  async executePrompt(request: AiPromptRequest): Promise<Result<AiPromptResponse, never>> {
    this.lastRequest = request;
    this.callCount++;

    return ok({
      content: this.defaultResponse,
      provider: 'mock',
      model: this.modelName,
      usage: {
        promptTokens: request.userPrompt.length,
        completionTokens: this.defaultResponse.length,
        totalTokens: request.userPrompt.length + this.defaultResponse.length,
      },
    });
  }
}
