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

describe('Stage 10 — AI Concept Generation Resilience & Accounting', () => {
  const groundedAttributes = ExtractedDesignAttributes.create({
    jewelryType: 'RING',
    metalType: 'GOLD',
    karatEquivalent: '18',
    gemstoneType: 'DIAMOND',
  }).unwrap();

  it('generates grounded concept proposals via MockAiGatewayAdapter with token accounting', async () => {
    const mockAdapter = new MockAiGatewayAdapter();
    const client = new AiGatewayClient({ adapter: mockAdapter });

    const result = await client.generateConcept({
      promptRefinement: 'Incorporate classic solitaire prongs',
      groundedAttributes,
      idempotencyKey: 'idemp_test_1',
    });

    expect(result.isOk).toBe(true);
    const concept = result.unwrap();
    expect(concept.title).toContain('Solitaire');
    expect(concept.visualPrompt).toBeDefined();
    expect(concept.tokenAccounting.totalTokens).toBeGreaterThan(0);
    expect(concept.provider).toBe('mock');
    expect(concept.groundedAttributes.jewelryType).toBe('RING');
  });

  it('handles provider unavailability with 503 AiProviderUnavailableError', async () => {
    const client = new AiGatewayClient({
      adapter: new UnavailableAiGatewayAdapter('AI Concept service unavailable in region'),
    });

    const result = await client.generateConcept({
      promptRefinement: 'Refine design',
      groundedAttributes,
      idempotencyKey: 'idemp_unavailable',
    });

    expect(result.isErr).toBe(true);
    if (result.isErr) {
      expect(result.error).toBeInstanceOf(AiProviderUnavailableError);
      expect(result.error.httpStatus).toBe(503);
      expect(result.error.message).toContain('AI Concept service unavailable');
    }
  });

  it('enforces gateway timeout boundaries and returns 504 AiTimeoutError', async () => {
    const slowMock = new MockAiGatewayAdapter({
      simulateTimeout: true,
    });
    const client = new AiGatewayClient({
      adapter: slowMock,
      defaultTimeoutMs: 50,
    });

    const result = await client.generateConcept({
      promptRefinement: 'Timeout trigger',
      groundedAttributes,
      idempotencyKey: 'idemp_timeout',
      timeoutMs: 50,
    });

    expect(result.isErr).toBe(true);
    if (result.isErr) {
      expect(result.error).toBeInstanceOf(AiTimeoutError);
      expect(result.error.httpStatus).toBe(504);
      expect(result.error.message).toContain('Concept generation timed out');
    }
  });
});
