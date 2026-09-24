import { describe, expect, it } from 'vitest';
import {
  Tenant,
  Store,
  createEntityId,
  type TenantId,
  ActorReference,
  JewelryIdentity,
} from '@v-gold/core';

describe('Tenant & Store Domain Entities', () => {
  it('creates a valid Tenant with normalized slug and active status', () => {
    const actor = ActorReference.user('admin-1').unwrap();
    const tenant = Tenant.create({
      name: 'Zar-e Tehran Guild',
      slug: 'zar-tehran',
      actor,
    }).unwrap();

    expect(tenant.name).toBe('Zar-e Tehran Guild');
    expect(tenant.slug).toBe('zar-tehran');
    expect(tenant.status).toBe('ACTIVE');
    expect(tenant.audit.createdBy?.actorId).toBe('admin-1');
  });

  it('rejects invalid tenant slugs or empty names', () => {
    expect(Tenant.create({ name: '', slug: 'valid-slug' }).isErr).toBe(true);
    expect(Tenant.create({ name: 'Valid Name', slug: '' }).isErr).toBe(true);
    // Uppercase or special characters in slug are rejected
    expect(Tenant.create({ name: 'Valid Name', slug: 'Invalid Slug!' }).isErr).toBe(true);
  });

  it('handles tenant status transitions and name updates', () => {
    const tenant = Tenant.create({ name: 'Initial', slug: 'initial-tenant' }).unwrap();
    expect(tenant.status).toBe('ACTIVE');

    tenant.suspend();
    expect(tenant.status).toBe('SUSPENDED');

    tenant.activate();
    expect(tenant.status).toBe('ACTIVE');

    tenant.updateName('Updated Name').unwrap();
    expect(tenant.name).toBe('Updated Name');
    expect(tenant.updateName('').isErr).toBe(true);
  });

  it('creates a Store strictly bound to a tenantId', () => {
    const tenantId = createEntityId<TenantId>('tenant-123');
    const store = Store.create({
      tenantId,
      name: 'Main Boutique',
      code: 'STORE_MAIN',
    }).unwrap();

    expect(store.tenantId).toBe(tenantId);
    expect(store.name).toBe('Main Boutique');
    expect(store.code).toBe('STORE_MAIN');
    expect(store.status).toBe('ACTIVE');
  });

  it('rejects store creation with empty or invalid identifiers', () => {
    // createEntityId throws on empty string
    expect(() => createEntityId<TenantId>('')).toThrow('Entity ID cannot be empty');

    // Store.create rejects empty name or invalid code
    const validTenantId = createEntityId<TenantId>('t-1');
    expect(
      Store.create({
        tenantId: validTenantId,
        name: '',
        code: 'S1',
      }).isErr
    ).toBe(true);

    expect(
      Store.create({
        tenantId: validTenantId,
        name: 'Store',
        code: 'invalid code!',
      }).isErr
    ).toBe(true);
  });

  it('manages foundational JewelryIdentity and ActorReference', () => {
    const jewelry = JewelryIdentity.create('jewel-999', 'SKU-GLD-18K', '6260123456789').unwrap();
    expect(jewelry.id).toBe('jewel-999');
    expect(jewelry.sku).toBe('SKU-GLD-18K');
    expect(jewelry.barcode).toBe('6260123456789');

    const sysActor = ActorReference.system();
    expect(sysActor.actorType).toBe('SYSTEM');
    expect(sysActor.actorId).toBe('SYSTEM');
  });
});
