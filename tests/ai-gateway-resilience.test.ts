import { describe, expect, it } from 'vitest';
import {
  AiGatewayClient,
  MockAiGatewayAdapter,
  UnavailableAiGatewayAdapter,
} from '@v-gold/ai-gateway';
import {
  ExtractedDesignAttributes,
  AiProviderUnavailableError,
  AiTimeoutError,
} from '@v-gold/core';

describe('Stage 9 — AI Gateway Attribute Extraction & Resilience', () => {
  it('extracts design attributes via MockAiGatewayAdapter', async () => {
    const mockAdapter = new MockAiGatewayAdapter({
      defaultAssistantReply: 'Great choice of 18K emerald pendant.',
      defaultExtractedAttributes: ExtractedDesignAttributes.create({
        jewelryType: 'PENDANT',
        metalType: 'GOLD',
        karatEquivalent: '18',
        gemstoneType: 'EMERALD',
        occasion: 'GIFT',
      }).unwrap(),
    });

    const client = new AiGatewayClient({ adapter: mockAdapter });

    const result = await client.extractDesignAttributes({
      latestUserMessage: 'I need an emerald pendant in 18k gold for a gift.',
    });

    expect(result.isOk).toBe(true);
    const val = result.unwrap();
    expect(val.assistantReply).toBe('Great choice of 18K emerald pendant.');
    expect(val.extractedAttributes.jewelryType).toBe('PENDANT');
    expect(val.extractedAttributes.gemstoneType).toBe('EMERALD');
    expect(val.extractedAttributes.occasion).toBe('GIFT');
    expect(mockAdapter.callCount).toBe(1);
  });

  it('handles provider unavailability honestly without pretending AI works', async () => {
    const client = new AiGatewayClient({
      adapter: new UnavailableAiGatewayAdapter('OpenAI service unconfigured'),
    });

    const result = await client.extractDesignAttributes({
      latestUserMessage: 'Can you design a gold bracelet?',
    });

    expect(result.isErr).toBe(true);
    if (result.isErr) {
      expect(result.error).toBeInstanceOf(AiProviderUnavailableError);
      expect(result.error.httpStatus).toBe(503);
      expect(result.error.message).toContain('OpenAI service unconfigured');
    }
  });

  it('enforces gateway timeout boundaries and returns 504 AiTimeoutError', async () => {
    const slowMockAdapter = new MockAiGatewayAdapter({
      simulateTimeout: true,
    });

    const client = new AiGatewayClient({
      adapter: slowMockAdapter,
      defaultTimeoutMs: 50, // Short timeout for test
    });

    const result = await client.extractDesignAttributes({
      latestUserMessage: 'Slow request expecting timeout',
      timeoutMs: 50,
    });

    expect(result.isErr).toBe(true);
    if (result.isErr) {
      expect(result.error).toBeInstanceOf(AiTimeoutError);
      expect(result.error.httpStatus).toBe(504);
      expect(result.error.message).toContain('Attribute extraction timed out');
    }
  });
});
