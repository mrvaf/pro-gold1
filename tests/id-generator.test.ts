import { describe, expect, it, afterEach } from 'vitest';
import {
  uuidv7,
  isUuidV7,
  generateId,
  UuidV7IdGenerator,
  setDefaultIdGenerator,
  getDefaultIdGenerator,
  Product,
  User,
  TenantMembership,
  Email,
  PasswordHash,
  createEntityId,
  type TenantId,
  type UserId,
} from '@v-gold/core';

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('Stage 8.2 — IdGenerator (UUIDv7, CSPRNG, outside domain)', () => {
  afterEach(() => {
    setDefaultIdGenerator(new UuidV7IdGenerator());
  });

  it('uuidv7 produces RFC 9562 version-7 / variant-10xx identifiers', () => {
    for (let i = 0; i < 50; i++) {
      const id = uuidv7();
      expect(id).toMatch(UUID_V7_REGEX);
      expect(isUuidV7(id)).toBe(true);
    }
  });

  it('embeds a 48-bit millisecond timestamp (time-ordering) in the standard field', () => {
    const now = 1_758_000_000_000; // fixed instant
    const id = uuidv7(now);
    const tsHex = id.replace(/-/g, '').slice(0, 12);
    expect(BigInt(`0x${tsHex}`)).toBe(BigInt(now));

    const before = uuidv7(now - 1000);
    const after = uuidv7(now + 1000);
    expect(before < id).toBe(true);
    expect(id < after).toBe(true);
  });

  it('is collision-free across mass generation (72 bits of CSPRNG entropy per id)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      seen.add(generateId('prod'));
    }
    expect(seen.size).toBe(10_000);
  });

  it('keeps entity-type prefixes on generated ids (debuggability)', () => {
    expect(generateId('prod')).toMatch(/^prod_[0-9a-f]{8}-[0-9a-f]{4}-7/);
    expect(generateId('user')).toMatch(/^user_/);
    expect(generateId()).toMatch(UUID_V7_REGEX);
  });

  it('supports deterministic injection via setDefaultIdGenerator (composition root / tests)', () => {
    let counter = 0;
    setDefaultIdGenerator({
      generate: (prefix?: string) => `${prefix ?? 'id'}_deterministic_${++counter}`,
    });
    expect(getDefaultIdGenerator().generate('x')).toBe('x_deterministic_1');
    expect(generateId('prod')).toBe('prod_deterministic_2');
  });

  it('entity factories delegate to the port: auto ids are prefixed UUIDv7, explicit ids preserved', () => {
    const tenantId = createEntityId<TenantId>('tenant_id_gen_test');
    const userId = createEntityId<UserId>('user_id_gen_test');

    const product = Product.create({
      tenantId,
      name: 'ID Gen Product',
      productType: 'RING',
    }).unwrap();
    expect(product.id).toMatch(/^prod_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(isUuidV7(product.id.slice('prod_'.length))).toBe(true);

    const explicit = Product.create({
      id: 'prod_explicit_keep',
      tenantId,
      name: 'Explicit Product',
      productType: 'RING',
    }).unwrap();
    expect(explicit.id).toBe('prod_explicit_keep');

    const user = User.create({
      email: Email.create('idgen@vgold.test').unwrap(),
      displayName: 'ID Gen User',
      passwordHash: PasswordHash.create('scrypt$N=16384,r=8,p=1$1234567890abcdef$0987654321fedcba').unwrap(),
    }).unwrap();
    expect(isUuidV7(user.id.slice('user_'.length))).toBe(true);

    const autoMembership = TenantMembership.create({ tenantId, userId, role: 'OWNER' }).unwrap();
    expect(isUuidV7(autoMembership.id.slice('mem_'.length))).toBe(true);

    const explicitMembership = TenantMembership.create({
      id: 'mem_explicit_keep',
      tenantId,
      userId,
      role: 'OWNER',
    }).unwrap();
    expect(explicitMembership.id).toBe('mem_explicit_keep');
  });
});
