import { describe, expect, it } from 'vitest';
import {
  Entity,
  ValueObject,
  createEntityId,
  type EntityId,
  ok,
  err,
  AiProviderUnavailableError,
} from '@v-gold/core';
import {
  AiGatewayClient,
  MockAiGatewayAdapter,
  UnavailableAiGatewayAdapter,
} from '@v-gold/ai-gateway';
import {
  InMemoryRepository,
  InMemoryTenantScopedRepository,
  createDatabaseConfigFromEnv,
} from '@v-gold/database';

// Test entities
type TestUserId = EntityId<'User'>;
class TestUser extends Entity<TestUserId> {
  constructor(id: TestUserId, readonly name: string) {
    super(id);
  }
}

class TestPriceValueObject extends ValueObject<{ amount: string; currency: string }> {
  get amount(): string {
    return this.props.amount;
  }
  get currency(): string {
    return this.props.currency;
  }
}

describe('Foundation & Layer Boundary Behavior', () => {
  describe('Domain Primitives (@v-gold/core)', () => {
    it('handles Result Ok and Err branching deterministically', () => {
      const goodResult = ok<number, Error>(42);
      expect(goodResult.isOk).toBe(true);
      expect(goodResult.isErr).toBe(false);
      expect(goodResult.unwrap()).toBe(42);

      const badResult = err<number, Error>(new Error('Boom'));
      expect(badResult.isOk).toBe(false);
      expect(badResult.isErr).toBe(true);
      expect(badResult.unwrapOr(99)).toBe(99);
      expect(() => badResult.unwrap()).toThrow('Boom');
    });

    it('enforces entity identity equality', () => {
      const id1 = createEntityId<TestUserId>('user-1');
      const id2 = createEntityId<TestUserId>('user-2');
      const userA = new TestUser(id1, 'Ali');
      const userB = new TestUser(id1, 'Ali Different Name');
      const userC = new TestUser(id2, 'Ali');

      expect(userA.equals(userB)).toBe(true);
      expect(userA.equals(userC)).toBe(false);
    });

    it('enforces value object structural equality', () => {
      const p1 = new TestPriceValueObject({ amount: '1000', currency: 'IRR' });
      const p2 = new TestPriceValueObject({ amount: '1000', currency: 'IRR' });
      const p3 = new TestPriceValueObject({ amount: '2000', currency: 'IRR' });

      expect(p1.equals(p2)).toBe(true);
      expect(p1.equals(p3)).toBe(false);
    });
  });

  describe('AI Gateway Abstraction & Fallback (@v-gold/ai-gateway)', () => {
    it('defaults to UnavailableAiGatewayAdapter with truthful 503 error', async () => {
      const client = new AiGatewayClient();
      const result = await client.executePrompt({ userPrompt: 'Create a ring' });

      expect(result.isErr).toBe(true);
      if (result.isErr) {
        expect(result.error).toBeInstanceOf(AiProviderUnavailableError);
        expect(result.error.httpStatus).toBe(503);
        expect(result.error.code).toBe('AI_PROVIDER_UNAVAILABLE');
      }
    });

    it('supports MockAiGatewayAdapter for deterministic testing', async () => {
      const mockAdapter = new MockAiGatewayAdapter({
        defaultResponse: '{"design": "Gold Ring 18K"}',
      });
      const client = new AiGatewayClient({ adapter: mockAdapter });

      const result = await client.executePrompt({ userPrompt: 'Generate concept' });
      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.provider).toBe('mock');
        expect(result.value.content).toContain('Gold Ring 18K');
      }
      expect(mockAdapter.callCount).toBe(1);
    });
  });

  describe('Database Infrastructure & Multi-Tenancy (@v-gold/database)', () => {
    it('in-memory repository correctly stores and retrieves entities', async () => {
      const repo = new InMemoryRepository<TestUser, TestUserId>();
      const userId = createEntityId<TestUserId>('u-123');
      const user = new TestUser(userId, 'Sara');

      await repo.save(user);
      const found = await repo.findById(userId);

      expect(found).not.toBeNull();
      expect(found?.name).toBe('Sara');
      expect(repo.count).toBe(1);

      await repo.delete(userId);
      expect(await repo.findById(userId)).toBeNull();
      expect(repo.count).toBe(0);
    });

    it('in-memory tenant-scoped repository guarantees strict tenant isolation', async () => {
      const repo = new InMemoryTenantScopedRepository<TestUser, TestUserId>();
      const storeA = createEntityId<EntityId<'Store'>>('store-A');
      const storeB = createEntityId<EntityId<'Store'>>('store-B');
      const item1 = new TestUser(createEntityId<TestUserId>('item-1'), 'Product 1');

      // Save item in Store A
      await repo.save(storeA, item1);

      // Verify Store A has the item
      const foundInA = await repo.findById(storeA, item1.id);
      expect(foundInA).not.toBeNull();
      expect(foundInA?.id).toBe(item1.id);

      // Verify Store B CANNOT see Store A's item (Tenant Isolation Invariant)
      const foundInB = await repo.findById(storeB, item1.id);
      expect(foundInB).toBeNull();

      const allA = await repo.findAll(storeA);
      const allB = await repo.findAll(storeB);
      expect(allA.length).toBe(1);
      expect(allB.length).toBe(0);
    });

    it('creates database config with secure defaults from environment', () => {
      const config = createDatabaseConfigFromEnv({
        DATABASE_HOST: 'postgres.internal',
        DATABASE_PORT: '5433',
        DATABASE_USER: 'vgold_admin',
        DATABASE_NAME: 'vgold_production',
        DATABASE_SSL: 'true',
      });

      expect(config.host).toBe('postgres.internal');
      expect(config.port).toBe(5433);
      expect(config.user).toBe('vgold_admin');
      expect(config.database).toBe('vgold_production');
      expect(config.ssl).toBe(true);
    });
  });
});
