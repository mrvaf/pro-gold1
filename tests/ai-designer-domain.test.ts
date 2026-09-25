import { describe, expect, it } from 'vitest';
import {
  DesignSession,
  DesignMessage,
  ExtractedDesignAttributes,
  DesignSessionStateMachine,
  InvalidDesignSessionStateError,
  ValidationError,
  createEntityId,
  type TenantId,
  type UserId,
  ActorReference,
} from '@v-gold/core';

describe('Stage 9 — AI Conversational Designer Domain Models', () => {
  const tenantId = createEntityId<TenantId>('tenant_alpha');
  const userId = createEntityId<UserId>('user_123');

  describe('DesignMessage Value Object', () => {
    it('creates a valid user message', () => {
      const res = DesignMessage.create({
        role: 'USER',
        content: 'I want a modern 18k gold engagement ring with a solitary diamond.',
      });
      expect(res.isOk).toBe(true);
      const msg = res.unwrap();
      expect(msg.role).toBe('USER');
      expect(msg.content).toContain('18k gold');
      expect(msg.id).toBeDefined();
      expect(msg.timestamp).toBeDefined();
    });

    it('rejects empty message content', () => {
      const res = DesignMessage.create({
        role: 'USER',
        content: '   ',
      });
      expect(res.isErr).toBe(true);
      if (res.isErr) {
        expect(res.error).toBeInstanceOf(ValidationError);
      }
    });

    it('rejects oversized content (> 8000 chars)', () => {
      const res = DesignMessage.create({
        role: 'USER',
        content: 'a'.repeat(8001),
      });
      expect(res.isErr).toBe(true);
      if (res.isErr) {
        expect(res.error).toBeInstanceOf(ValidationError);
      }
    });
  });

  describe('ExtractedDesignAttributes Value Object', () => {
    it('validates and creates structured jewelry attributes', () => {
      const res = ExtractedDesignAttributes.create({
        jewelryType: 'RING',
        metalType: 'GOLD',
        purityFineness: '750',
        karatEquivalent: '18',
        gemstoneType: 'DIAMOND',
        gemstoneDescription: 'Round brilliant cut',
        occasion: 'ENGAGEMENT',
        estimatedWeightGrams: '4.5',
      });
      expect(res.isOk).toBe(true);
      const attrs = res.unwrap();
      expect(attrs.jewelryType).toBe('RING');
      expect(attrs.metalType).toBe('GOLD');
      expect(attrs.karatEquivalent).toBe('18');
      expect(attrs.gemstoneType).toBe('DIAMOND');
      expect(attrs.occasion).toBe('ENGAGEMENT');
    });

    it('rejects invalid jewelry type', () => {
      const res = ExtractedDesignAttributes.create({
        jewelryType: 'SPACESHIP' as any,
      });
      expect(res.isErr).toBe(true);
      if (res.isErr) {
        expect(res.error).toBeInstanceOf(ValidationError);
      }
    });

    it('merges new attributes without erasing previously extracted attributes', () => {
      const first = ExtractedDesignAttributes.create({
        jewelryType: 'RING',
        metalType: 'GOLD',
      }).unwrap();

      const second = ExtractedDesignAttributes.create({
        gemstoneType: 'DIAMOND',
        occasion: 'ENGAGEMENT',
      }).unwrap();

      const merged = first.merge(second);
      expect(merged.jewelryType).toBe('RING');
      expect(merged.metalType).toBe('GOLD');
      expect(merged.gemstoneType).toBe('DIAMOND');
      expect(merged.occasion).toBe('ENGAGEMENT');
    });
  });

  describe('DesignSession Aggregate', () => {
    it('creates an active design session with initial state', () => {
      const res = DesignSession.create({
        tenantId,
        userId,
        title: 'Custom Diamond Ring',
        initialMessage: 'Looking for a classic ring',
      });

      expect(res.isOk).toBe(true);
      const session = res.unwrap();
      expect(session.id.startsWith('dsgn_')).toBe(true);
      expect(session.status).toBe('ACTIVE');
      expect(session.title).toBe('Custom Diamond Ring');
      expect(session.messages.length).toBe(1);
      expect(session.messages[0].role).toBe('USER');
      expect(session.messages[0].content).toBe('Looking for a classic ring');
      expect(session.extractedAttributes.jewelryType).toBeUndefined();
    });

    it('adds conversation messages and updates extracted attributes', () => {
      const session = DesignSession.create({ tenantId }).unwrap();

      const userMsgRes = session.addMessage({
        role: 'USER',
        content: 'I want 18k yellow gold with ruby gemstone for anniversary',
      });
      expect(userMsgRes.isOk).toBe(true);

      const assistantMsgRes = session.addMessage({
        role: 'ASSISTANT',
        content: 'That sounds beautiful! What size or budget do you have in mind?',
      });
      expect(assistantMsgRes.isOk).toBe(true);

      expect(session.messages.length).toBe(2);

      const attrs = ExtractedDesignAttributes.create({
        metalType: 'GOLD',
        purityFineness: '750',
        karatEquivalent: '18',
        gemstoneType: 'RUBY',
        occasion: 'ANNIVERSARY',
      }).unwrap();

      const updateRes = session.updateExtractedAttributes(attrs);
      expect(updateRes.isOk).toBe(true);
      expect(session.extractedAttributes.gemstoneType).toBe('RUBY');
      expect(session.extractedAttributes.occasion).toBe('ANNIVERSARY');
    });

    it('enforces lifecycle state machine (ACTIVE -> COMPLETED)', () => {
      const session = DesignSession.create({ tenantId }).unwrap();
      expect(session.status).toBe('ACTIVE');

      const compRes = session.complete();
      expect(compRes.isOk).toBe(true);
      expect(session.status).toBe('COMPLETED');
      expect(session.isActive).toBe(false);

      // Mutating completed session is rejected
      const addRes = session.addMessage({ role: 'USER', content: 'Can we add a diamond?' });
      expect(addRes.isErr).toBe(true);
      if (addRes.isErr) {
        expect(addRes.error).toBeInstanceOf(InvalidDesignSessionStateError);
      }
    });

    it('enforces lifecycle state machine (ACTIVE -> ABANDONED)', () => {
      const session = DesignSession.create({ tenantId }).unwrap();
      const abRes = session.abandon();
      expect(abRes.isOk).toBe(true);
      expect(session.status).toBe('ABANDONED');

      // Cannot transition from ABANDONED to COMPLETED
      const compRes = session.complete();
      expect(compRes.isErr).toBe(true);
      if (compRes.isErr) {
        expect(compRes.error).toBeInstanceOf(InvalidDesignSessionStateError);
      }
    });
  });
});
