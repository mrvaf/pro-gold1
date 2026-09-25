import {
  type AiGatewayPort,
  type AiPromptRequest,
  type AiPromptResponse,
  type AttributeExtractionRequest,
  type AttributeExtractionResponse,
  ExtractedDesignAttributes,
  ok,
  type Result,
} from '@v-gold/core';

export interface MockAiGatewayOptions {
  readonly defaultResponse?: string;
  readonly modelName?: string;
  readonly defaultAssistantReply?: string;
  readonly defaultExtractedAttributes?: ExtractedDesignAttributes;
  readonly simulateTimeout?: boolean;
}

/**
 * Mock AI Adapter for deterministic automated unit & integration testing.
 */
export class MockAiGatewayAdapter implements AiGatewayPort {
  private readonly defaultResponse: string;
  private readonly modelName: string;
  private readonly defaultAssistantReply: string;
  private readonly defaultExtractedAttributes: ExtractedDesignAttributes;
  private readonly simulateTimeout: boolean;

  public lastRequest: AiPromptRequest | null = null;
  public lastExtractionRequest: AttributeExtractionRequest | null = null;
  public callCount = 0;

  constructor(options: MockAiGatewayOptions = {}) {
    this.defaultResponse = options.defaultResponse ?? 'MOCK_AI_RESPONSE';
    this.modelName = options.modelName ?? 'mock-model-v1';
    this.defaultAssistantReply =
      options.defaultAssistantReply ??
      'من متوجه سلیقه شما شدم. یک انگشتر طلای ۱۸ عیار با نگین الماس برای شما طراحی می‌کنیم.';
    this.defaultExtractedAttributes =
      options.defaultExtractedAttributes ??
      ExtractedDesignAttributes.create({
        jewelryType: 'RING',
        metalType: 'GOLD',
        purityFineness: '750',
        karatEquivalent: '18',
        gemstoneType: 'DIAMOND',
        occasion: 'ENGAGEMENT',
      }).unwrap();
    this.simulateTimeout = options.simulateTimeout ?? false;
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

  async extractDesignAttributes(
    request: AttributeExtractionRequest
  ): Promise<Result<AttributeExtractionResponse, never>> {
    this.lastExtractionRequest = request;
    this.callCount++;

    if (this.simulateTimeout) {
      await new Promise((resolve) => setTimeout(resolve, (request.timeoutMs ?? 50) + 20));
    }

    return ok({
      assistantReply: this.defaultAssistantReply,
      extractedAttributes: this.defaultExtractedAttributes,
      provider: 'mock',
      model: this.modelName,
    });
  }
}
