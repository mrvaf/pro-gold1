import { describe, it, expect } from 'vitest';
import { StyleDna } from '../packages/core/src/domain/product/style-dna.js';
import { DigitalJewelryPassport } from '../packages/core/src/domain/product/digital-jewelry-passport.js';
import { InMemoryDigitalJewelryPassportRepository } from '../packages/database/src/adapters/in-memory-digital-jewelry-passport.repository.js';

describe('Stage 26 — Future Platform Extensions', () => {
  describe('StyleDna Value Object', () => {
    it('creates a valid style DNA profile with bounded metrics', () => {
      const dnaResult = StyleDna.create({
        aestheticStyle: 'persian_baroque',
        primaryMotif: 'arabesque',
        finishPreference: 'high_polish',
        symmetryScore: 0.85,
        complexityScore: 0.92,
        tags: ['filigree', 'traditional', 'royal'],
      });

      expect(dnaResult.isOk).toBe(true);
      const dna = dnaResult.unwrap();
      expect(dna.aestheticStyle).toBe('PERSIAN_BAROQUE');
      expect(dna.primaryMotif).toBe('ARABESQUE');
      expect(dna.finishPreference).toBe('HIGH_POLISH');
      expect(dna.symmetryScore).toBe(0.85);
      expect(dna.tags).toContain('filigree');
    });

    it('rejects invalid scores out of bounds', () => {
      const invalid = StyleDna.create({
        aestheticStyle: 'minimalist',
        primaryMotif: 'geometric',
        finishPreference: 'matte',
        symmetryScore: 1.5, // invalid
        complexityScore: 0.5,
        tags: [],
      });

      expect(invalid.isErr).toBe(true);
    });
  });

  describe('DigitalJewelryPassport & Provenance', () => {
    it('creates digital jewelry passport and securely appends provenance events', async () => {
      const dna = StyleDna.create({
        aestheticStyle: 'contemporary',
        primaryMotif: 'geometric',
        finishPreference: 'satin',
        symmetryScore: 0.75,
        complexityScore: 0.6,
        tags: ['modern', 'gold-18k'],
      }).unwrap();

      const passport = DigitalJewelryPassport.create('pass-001', {
        tenantId: 'tenant-123',
        productId: 'prod-456',
        serialNumber: 'SN-2026-X992',
        digitalCertificateNumber: 'CERT-VGOLD-98124',
        styleDna: dna,
        provenanceHistory: [
          {
            eventId: 'evt-1',
            eventType: 'ORIGIN_MANUFACTURE',
            actorId: 'goldsmith-user-1',
            timestamp: new Date('2026-01-10T10:00:00Z'),
            details: { workshopLocation: 'Tehran Grand Bazaar', assayOffice: 'Standard Organization' },
          },
        ],
        createdAt: new Date('2026-01-10T10:00:00Z'),
      }).unwrap();

      expect(passport.id).toBe('pass-001');
      expect(passport.provenanceHistory.length).toBe(1);

      const updated = passport.appendProvenanceEvent({
        eventId: 'evt-2',
        eventType: 'HALLMARK_CERTIFIED',
        actorId: 'guild-auditor-88',
        timestamp: new Date('2026-01-12T14:00:00Z'),
        details: { hallmarkNumber: 'T99-18K' },
      }).unwrap();

      expect(updated.provenanceHistory.length).toBe(2);
      expect(updated.provenanceHistory[1].eventType).toBe('HALLMARK_CERTIFIED');

      const repo = new InMemoryDigitalJewelryPassportRepository();
      await repo.save(updated);

      const found = await repo.findById('tenant-123', 'pass-001');
      expect(found.unwrap()?.serialNumber).toBe('SN-2026-X992');

      const foundBySerial = await repo.findBySerialNumber('tenant-123', 'SN-2026-X992');
      expect(foundBySerial.unwrap()?.id).toBe('pass-001');

      // Tenant isolation: querying from another tenant returns null
      const isolated = await repo.findById('foreign-tenant', 'pass-001');
      expect(isolated.unwrap()).toBeNull();
    });
  });
});
