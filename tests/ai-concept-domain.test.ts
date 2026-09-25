import { describe, expect, it } from 'vitest';
import {
  DesignConcept,
  ExtractedDesignAttributes,
  TokenAccounting,
  ConceptStateMachine,
  ConceptGroundingViolationError,
  InvalidConceptStateError,
  ValidationError,
  createEntityId,
  type TenantId,
  type DesignSessionId,
} from '@v-gold/core';

describe('Stage 10 — AI Concept Generation Domain Models & Invariants', () => {
  const tenantId = createEntityId<TenantId>('tenant_alpha');
  const sessionId = createEntityId<DesignSessionId>('dsgn_session_1');

  const validAttributes = ExtractedDesignAttributes.create({
    jewelryType: 'RING',
    metalType: 'GOLD',
    purityFineness: '750',
    karatEquivalent: '18',
    gemstoneType: 'DIAMOND',
    occasion: 'ENGAGEMENT',
  }).unwrap();

  describe('TokenAccounting Value Object', () => {
    it('creates valid token accounting record', () => {
      const res = TokenAccounting.create({
        promptTokens: 150,
        completionTokens: 250,
        totalTokens: 400,
        provider: 'mock-ai',
        model: 'concept-v1',
      });
      expect(res.isOk).toBe(true);
      const val = res.unwrap();
      expect(val.promptTokens).toBe(150);
      expect(val.completionTokens).toBe(250);
      expect(val.totalTokens).toBe(400);
      expect(val.provider).toBe('mock-ai');
      expect(val.model).toBe('concept-v1');
    });

    it('rejects mismatched token totals', () => {
      const res = TokenAccounting.create({
        promptTokens: 150,
        completionTokens: 250,
        totalTokens: 500, // Should be 400
        provider: 'mock-ai',
        model: 'concept-v1',
      });
      expect(res.isErr).toBe(true);
      if (res.isErr) {
        expect(res.error).toBeInstanceOf(ValidationError);
      }
    });

    it('rejects negative token counts', () => {
      const res = TokenAccounting.create({
        promptTokens: -10,
        completionTokens: 50,
        totalTokens: 40,
        provider: 'mock-ai',
        model: 'concept-v1',
      });
      expect(res.isErr).toBe(true);
      if (res.isErr) {
        expect(res.error).toBeInstanceOf(ValidationError);
      }
    });
  });

  describe('DesignConcept Aggregate Root & Grounding Enforcement', () => {
    it('creates a design concept strictly grounded in verified session attributes', () => {
      const res = DesignConcept.create({
        tenantId,
        sessionId,
        idempotencyKey: 'idemp_key_101',
        title: 'Celestial Diamond Ring',
        description: 'An elegant cathedral setting in 18k yellow gold.',
        promptRefinement: 'Refined prompt incorporating Persian filigree accents',
        visualPrompt: 'Studio lighting, 8k render of 18k gold diamond ring',
        groundedAttributes: validAttributes,
        tokenAccounting: TokenAccounting.create({
          promptTokens: 100,
          completionTokens: 100,
          totalTokens: 200,
          provider: 'mock',
          model: 'mock-model',
        }).unwrap(),
      });

      expect(res.isOk).toBe(true);
      const concept = res.unwrap();
      expect(concept.id.startsWith('cpt_')).toBe(true);
      expect(concept.status).toBe('GENERATED');
      expect(concept.groundedAttributes.jewelryType).toBe('RING');
      expect(concept.groundedAttributes.karatEquivalent).toBe('18');
      expect(concept.idempotencyKey).toBe('idemp_key_101');
    });

    it('refuses invalid material grounding (e.g. invalid karat out of gold boundary)', () => {
      const tamperedAttributes = ExtractedDesignAttributes.create({
        jewelryType: 'RING',
        metalType: 'GOLD',
        karatEquivalent: '30', // Contradicts domain physical limits (max 24k)
      }).unwrap();

      const res = DesignConcept.create({
        tenantId,
        sessionId,
        idempotencyKey: 'idemp_key_bad_grounding',
        title: 'Tampered Ring',
        description: 'Invalid 30k gold',
        promptRefinement: 'Refinement',
        visualPrompt: 'Prompt',
        groundedAttributes: tamperedAttributes,
      });

      expect(res.isErr).toBe(true);
      if (res.isErr) {
        expect(res.error).toBeInstanceOf(ConceptGroundingViolationError);
      }
    });

    it('enforces concept lifecycle state machine (GENERATED -> APPROVED)', () => {
      const concept = DesignConcept.create({
        tenantId,
        sessionId,
        idempotencyKey: 'idemp_approve',
        title: 'Royal Engagement Band',
        description: 'Royal design',
        promptRefinement: 'Refinement',
        visualPrompt: 'Prompt',
        groundedAttributes: validAttributes,
      }).unwrap();

      expect(concept.status).toBe('GENERATED');

      const appRes = concept.approve();
      expect(appRes.isOk).toBe(true);
      expect(concept.status).toBe('APPROVED');

      // Cannot transition from APPROVED to REJECTED
      const rejRes = concept.reject();
      expect(rejRes.isErr).toBe(true);
      if (rejRes.isErr) {
        expect(rejRes.error).toBeInstanceOf(InvalidConceptStateError);
      }
    });

    it('enforces concept lifecycle state machine (GENERATED -> REJECTED)', () => {
      const concept = DesignConcept.create({
        tenantId,
        sessionId,
        idempotencyKey: 'idemp_reject',
        title: 'Rejected Concept',
        description: 'Rejected',
        promptRefinement: 'Refinement',
        visualPrompt: 'Prompt',
        groundedAttributes: validAttributes,
      }).unwrap();

      const rejRes = concept.reject();
      expect(rejRes.isOk).toBe(true);
      expect(concept.status).toBe('REJECTED');

      // Cannot transition from REJECTED to APPROVED
      const appRes = concept.approve();
      expect(appRes.isErr).toBe(true);
      if (appRes.isErr) {
        expect(appRes.error).toBeInstanceOf(InvalidConceptStateError);
      }
    });
  });
});
