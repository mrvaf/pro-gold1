import { describe, expect, it } from 'vitest';
import {
  Tenant,
  Store,
  createEntityId,
  type TenantId,
  type StoreId,
  ActorReference,
} from '@v-gold/core';
import {
  toDomainTenant,
  toDatabaseTenant,
  toDomainStore,
  toDatabaseStore,
  type TenantRecord,
  type StoreRecord,
} from '@v-gold/database';

describe('Database Record <-> Domain Entity Mapping', () => {
  it('maps Tenant domain entity to Tenant database record and back', () => {
    const actor = ActorReference.user('admin-1').unwrap();
    const original = Tenant.create({
      name: 'Isfahan Goldsmiths',
      slug: 'isfahan-gold',
      actor,
    }).unwrap();

    const record = toDatabaseTenant(original);
    expect(record.id).toBe(original.id);
    expect(record.name).toBe('Isfahan Goldsmiths');
    expect(record.slug).toBe('isfahan-gold');
    expect(record.status).toBe('ACTIVE');
    expect(record.createdAt).toBeInstanceOf(Date);
    expect(record.updatedAt).toBeInstanceOf(Date);

    // Round-trip back to domain
    const reconstituted = toDomainTenant(record);
    expect(reconstituted.id).toBe(original.id);
    expect(reconstituted.name).toBe(original.name);
    expect(reconstituted.slug).toBe(original.slug);
    expect(reconstituted.status).toBe(original.status);
    expect(reconstituted.audit.createdAt.getTime()).toBe(original.audit.createdAt.getTime());
  });

  it('maps Store domain entity to Store database record and back', () => {
    const tenantId = createEntityId<TenantId>('tenant-xyz');
    const original = Store.create({
      tenantId,
      name: 'Grand Bazaar Store',
      code: 'BAZAAR_01',
    }).unwrap();

    const record = toDatabaseStore(original);
    expect(record.id).toBe(original.id);
    expect(record.tenantId).toBe(tenantId);
    expect(record.name).toBe('Grand Bazaar Store');
    expect(record.code).toBe('BAZAAR_01');
    expect(record.status).toBe('ACTIVE');

    // Round-trip back to domain
    const reconstituted = toDomainStore(record);
    expect(reconstituted.id).toBe(original.id);
    expect(reconstituted.tenantId).toBe(tenantId);
    expect(reconstituted.name).toBe(original.name);
    expect(reconstituted.code).toBe(original.code);
    expect(reconstituted.status).toBe(original.status);
  });
});
