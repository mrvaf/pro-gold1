import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as budgetRoute } from '../apps/web/app/api/v1/ai/budget-engine/route';
import {
  Tenant,
  User,
  Email,
  PasswordHash,
  TenantMembership,
  Session,
  PricingRule,
  MarketObservation,
  MarketPrice,
  createEntityId,
  type TenantId,
  type PricingRuleId,
  type MarketObservationId,
  type MarketInstrumentId,
  type MarketDataSourceId,
} from '@v-gold/core';
import { getDefaultAuthService } from '../apps/web/lib/auth/auth.service.js';
import { SESSION_COOKIE_NAME } from '../apps/web/lib/auth/session-cookie.js';
import { getBudgetEngineContainer } from '../apps/web/lib/budget-engine/budget-engine-container.js';

describe('Stage 12 Budget Engine API Integration Tests', () => {
  let sessionCookie: string;
  const tenantId = createEntityId<TenantId>('tenant_api_budget_test');

  beforeAll(async () => {
    const authService = getDefaultAuthService();
    const budgetContainer = getBudgetEngineContainer();

    // 1. Setup tenant, user, membership, session
    const tenant = Tenant.create({
      id: tenantId,
      name: 'API Budget Test Tenant',
      slug: 'api-budget-test',
    }).unwrap();
    await authService.tenantRepository.save(tenant);

    const user = User.create({
      email: Email.create('budget-owner@vgold.test').unwrap(),
      passwordHash: PasswordHash.create('$2b$10$abcdefghijklmnopqrstuvwxyz123456').unwrap(),
      displayName: 'API Budget Owner',
    }).unwrap();
    await authService.userRepository.save(user);

    const membership = TenantMembership.create({
      tenantId,
      userId: user.id,
      role: 'OWNER',
    }).unwrap();
    await authService.membershipRepository.save(membership);

    const session = Session.create({ id: 'b2'.repeat(32), userId: user.id }).unwrap();
    await authService.sessionRepository.save(session);
    sessionCookie = `${SESSION_COOKIE_NAME}=${session.id}`;

    // 2. Query what instrument exists in the repository for XAU/USD
    const inst = await budgetContainer.marketInstrumentRepo.findBySymbol('XAU/USD');
    const instrumentId = inst ? inst.id : createEntityId<MarketInstrumentId>('XAU/USD');

    // Save observation under BOTH inst.id and 'XAU/USD' symbol to be foolproof
    const obs = MarketObservation.create({
      id: createEntityId<MarketObservationId>(`obs_budget_test_${Date.now()}`),
      instrumentId,
      sourceId: createEntityId<MarketDataSourceId>('src_mock'),
      price: MarketPrice.create({
        amount: '2500.00',
        currency: 'USD',
        unit: 'TROY_OUNCE',
      }).unwrap(),
      quality: 'REAL_TIME',
      observedAt: new Date(),
    }).unwrap();
    await budgetContainer.marketObservationRepo.save(obs);

    if (inst && inst.id !== 'XAU/USD') {
      const obsFallback = MarketObservation.create({
        id: createEntityId<MarketObservationId>(`obs_budget_test_fb_${Date.now()}`),
        instrumentId: createEntityId<MarketInstrumentId>('XAU/USD'),
        sourceId: createEntityId<MarketDataSourceId>('src_mock'),
        price: MarketPrice.create({
          amount: '2500.00',
          currency: 'USD',
          unit: 'TROY_OUNCE',
        }).unwrap(),
        quality: 'REAL_TIME',
        observedAt: new Date(),
      }).unwrap();
      await budgetContainer.marketObservationRepo.save(obsFallback);
    }

    // 3. Seed pricing rule for this tenant
    const rule = PricingRule.create({
      id: createEntityId<PricingRuleId>('rule-budget-api-1'),
      tenantId,
      name: 'API Budget Test Rule',
      config: {
        makingCharge: { type: 'PERCENTAGE', rate: '0.12' },
        margin: { type: 'PERCENTAGE', rate: '0.07' },
        tax: { taxableBase: 'EXEMPT', rate: '0.0' },
        roundingScale: 2,
        roundingMode: 'HALF_UP',
      },
      effectiveFrom: new Date('2020-01-01'),
    }).unwrap();

    await budgetContainer.pricingRuleRepo.save(rule);
  });

  it('solves viable configurations for given budget ceiling via API', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/ai/budget-engine', {
      method: 'POST',
      headers: {
        cookie: sessionCookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        budgetCeiling: '3000.00',
        currency: 'USD',
        instrumentSymbol: 'XAU/USD',
        targetKarats: [18, 24],
        minWeightGrams: '1.0',
        maxWeightGrams: '40.0',
      }),
    });

    const res = await budgetRoute(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.count).toBe(2);
    expect(body.configurations.length).toBe(2);

    for (const config of body.configurations) {
      expect(Number(config.estimatedCost)).toBeLessThanOrEqual(3000.0);
      expect(Number(config.weightGrams)).toBeGreaterThanOrEqual(1.0);
    }
  });

  it('rejects unauthenticated request with 401', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/ai/budget-engine', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        budgetCeiling: '3000.00',
        currency: 'USD',
        instrumentSymbol: 'XAU/USD',
      }),
    });

    const res = await budgetRoute(req);
    expect(res.status).toBe(401);
  });
});
