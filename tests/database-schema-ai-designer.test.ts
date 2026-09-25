import { describe, expect, it } from 'vitest';
import {
  designSessionsTable,
  DrizzleDesignSessionRepository,
  InMemoryDesignSessionRepository,
} from '@v-gold/database';
import {
  DesignSession,
  DesignMessage,
  ExtractedDesignAttributes,
  createEntityId,
  type TenantId,
} from '@v-gold/core';

describe('Stage 9 — Database Schema & In-Memory Persistence', () => {
  it('exposes designSessionsTable with valid Drizzle schema column definitions', () => {
    expect(designSessionsTable).toBeDefined();
    expect(designSessionsTable.id).toBeDefined();
    expect(designSessionsTable.tenantId).toBeDefined();
    expect(designSessionsTable.userId).toBeDefined();
    expect(designSessionsTable.title).toBeDefined();
    expect(designSessionsTable.status).toBeDefined();
    expect(designSessionsTable.messagesJson).toBeDefined();
    expect(designSessionsTable.extractedAttributesJson).toBeDefined();
    expect(designSessionsTable.createdAt).toBeDefined();
    expect(designSessionsTable.updatedAt).toBeDefined();
  });

  it('supports full round-trip in InMemoryDesignSessionRepository', async () => {
    const repo = new InMemoryDesignSessionRepository();
    const tenantId = createEntityId<TenantId>('tenant_test');

    const session = DesignSession.create({
      tenantId,
      title: 'Diamond Wedding Band',
      initialMessage: 'Looking for platinum and diamonds',
    }).unwrap();

    await repo.save(session);

    const found = await repo.findById(session.id, tenantId);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(session.id);
    expect(found!.title).toBe('Diamond Wedding Band');
    expect(found!.messages.length).toBe(1);
    expect(found!.messages[0].content).toBe('Looking for platinum and diamonds');

    // List by tenant
    const listed = await repo.listByTenant(tenantId);
    expect(listed.length).toBe(1);
    expect(listed[0].id).toBe(session.id);

    // Cross-tenant isolation in findById
    const crossTenant = await repo.findById(session.id, createEntityId<TenantId>('other_tenant'));
    expect(crossTenant).toBeNull();
  });
});
