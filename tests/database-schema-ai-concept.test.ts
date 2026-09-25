import { describe, expect, it } from 'vitest';
import {
  designConceptsTable,
  DrizzleDesignConceptRepository,
  InMemoryDesignConceptRepository,
} from '@v-gold/database';
import {
  DesignConcept,
  ExtractedDesignAttributes,
  TokenAccounting,
  createEntityId,
  type TenantId,
  type DesignSessionId,
} from '@v-gold/core';

describe('Stage 10 — Database Schema & Concept Persistence', () => {
  it('exposes designConceptsTable with valid Drizzle schema column definitions', () => {
    expect(designConceptsTable).toBeDefined();
    expect(designConceptsTable.id).toBeDefined();
    expect(designConceptsTable.sessionId).toBeDefined();
    expect(designConceptsTable.tenantId).toBeDefined();
    expect(designConceptsTable.idempotencyKey).toBeDefined();
    expect(designConceptsTable.title).toBeDefined();
    expect(designConceptsTable.status).toBeDefined();
    expect(designConceptsTable.groundedAttributesJson).toBeDefined();
    expect(designConceptsTable.tokenAccountingJson).toBeDefined();
  });

  it('supports full round-trip and idempotency key search in InMemoryDesignConceptRepository', async () => {
    const repo = new InMemoryDesignConceptRepository();
    const tenantId = createEntityId<TenantId>('tenant_test');
    const sessionId = createEntityId<DesignSessionId>('session_test');

    const attrs = ExtractedDesignAttributes.create({
      jewelryType: 'PENDANT',
      metalType: 'GOLD',
      purityFineness: '750',
    }).unwrap();

    const concept = DesignConcept.create({
      tenantId,
      sessionId,
      idempotencyKey: 'idemp_pers_1',
      title: 'Pendant Concept',
      description: 'Handmade pendant',
      promptRefinement: 'Refined prompt',
      visualPrompt: 'Pendant photo',
      groundedAttributes: attrs,
    }).unwrap();

    await repo.save(concept);

    // Find by ID
    const found = await repo.findById(concept.id, tenantId);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(concept.id);
    expect(found!.idempotencyKey).toBe('idemp_pers_1');

    // Find by Idempotency Key
    const foundByIdemp = await repo.findByIdempotencyKey(tenantId, sessionId, 'idemp_pers_1');
    expect(foundByIdemp).not.toBeNull();
    expect(foundByIdemp!.id).toBe(concept.id);

    // List by session
    const list = await repo.listBySession(sessionId, tenantId);
    expect(list.length).toBe(1);

    // Cross-tenant isolation
    const crossTenant = await repo.findById(concept.id, createEntityId<TenantId>('other_tenant'));
    expect(crossTenant).toBeNull();
  });
});
