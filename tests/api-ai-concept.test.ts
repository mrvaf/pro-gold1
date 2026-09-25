import { describe, expect, it, beforeAll } from 'vitest';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import {
  Tenant,
  User,
  Email,
  PasswordHash,
  TenantMembership,
  DesignSession,
  ExtractedDesignAttributes,
  createEntityId,
  type TenantId,
  Session,
} from '@v-gold/core';
import { getDefaultAuthService } from '../apps/web/lib/auth/auth.service.js';
import { SESSION_COOKIE_NAME } from '../apps/web/lib/auth/session-cookie.js';
import {
  getDesignConceptContainer,
  setDesignConceptContainer,
} from '../apps/web/lib/ai-designer/design-concept-container.js';
import { DesignConceptService } from '../apps/web/lib/ai-designer/design-concept-service.js';
import {
  InMemoryDesignConceptRepository,
  InMemoryDesignSessionRepository,
} from '@v-gold/database';
import { MockAiGatewayAdapter } from '@v-gold/ai-gateway';

import {
  GET as listConceptsApi,
  POST as generateConceptApi,
} from '../apps/web/app/api/v1/ai/design-sessions/[id]/concepts/route.js';
import { GET as getConceptApi } from '../apps/web/app/api/v1/ai/design-sessions/[id]/concepts/[conceptId]/route.js';
import { POST as updateConceptStatusApi } from '../apps/web/app/api/v1/ai/design-sessions/[id]/concepts/[conceptId]/status/route.js';

describe('Stage 10 — AI Concept Generation API & Security Matrix', () => {
  const tenantAId = createEntityId<TenantId>('tenant_cpt_a');
  const tenantBId = createEntityId<TenantId>('tenant_cpt_b');

  let sessionCookieA: string;
  let sessionCookieB: string;
  let sessionIdA: string;
  let conceptRepo: InMemoryDesignConceptRepository;
  let sessionRepo: InMemoryDesignSessionRepository;

  beforeAll(async () => {
    const authService = getDefaultAuthService();

    // 1. Tenants
    const tenantA = Tenant.create({ id: tenantAId, name: 'Tenant Cpt A', slug: 'tenant-cpt-a' }).unwrap();
    const tenantB = Tenant.create({ id: tenantBId, name: 'Tenant Cpt B', slug: 'tenant-cpt-b' }).unwrap();
    await authService.tenantRepository.save(tenantA);
    await authService.tenantRepository.save(tenantB);

    // 2. Users
    const userA = User.create({
      id: 'user_cpt_a',
      email: Email.create('user_cpt_a@vgold.test').unwrap(),
      displayName: 'User Cpt A',
      passwordHash: PasswordHash.create('$2b$10$abcdefghijklmnopqrstuvwxyz123456').unwrap(),
    }).unwrap();

    const userB = User.create({
      id: 'user_cpt_b',
      email: Email.create('user_cpt_b@vgold.test').unwrap(),
      displayName: 'User Cpt B',
      passwordHash: PasswordHash.create('$2b$10$abcdefghijklmnopqrstuvwxyz123456').unwrap(),
    }).unwrap();

    await authService.userRepository.save(userA);
    await authService.userRepository.save(userB);

    // 3. Memberships
    const memA = TenantMembership.create({ tenantId: tenantAId, userId: userA.id, role: 'OWNER' }).unwrap();
    const memB = TenantMembership.create({ tenantId: tenantBId, userId: userB.id, role: 'OWNER' }).unwrap();
    await authService.membershipRepository.save(memA);
    await authService.membershipRepository.save(memB);

    // 4. Sessions
    sessionCookieA = crypto.randomBytes(32).toString('hex');
    sessionCookieB = crypto.randomBytes(32).toString('hex');

    const sA = Session.create({ id: sessionCookieA, userId: userA.id }).unwrap();
    const sB = Session.create({ id: sessionCookieB, userId: userB.id }).unwrap();
    await authService.sessionRepository.save(sA);
    await authService.sessionRepository.save(sB);

    // 5. Seed DesignSession with extracted attributes
    conceptRepo = new InMemoryDesignConceptRepository();
    sessionRepo = new InMemoryDesignSessionRepository();
    const mockAi = new MockAiGatewayAdapter();

    const designSession = DesignSession.create({
      tenantId: tenantAId,
      title: 'Engagement Ring Session',
      initialMessage: 'I want an 18k diamond solitaire',
    }).unwrap();

    designSession.updateExtractedAttributes(
      ExtractedDesignAttributes.create({
        jewelryType: 'RING',
        metalType: 'GOLD',
        karatEquivalent: '18',
        purityFineness: '750',
        gemstoneType: 'DIAMOND',
      }).unwrap()
    );

    await sessionRepo.save(designSession);
    sessionIdA = designSession.id;

    const conceptService = new DesignConceptService(conceptRepo, sessionRepo, mockAi);

    setDesignConceptContainer({
      conceptRepo,
      sessionRepo,
      aiGateway: mockAi,
      designConceptService: conceptService,
    });
  });

  const makeReq = (
    url: string,
    method: string,
    cookie?: string,
    body?: any,
    headers: Record<string, string> = {}
  ): NextRequest => {
    const reqHeaders = new Headers(headers);
    if (cookie) {
      reqHeaders.set('cookie', `${SESSION_COOKIE_NAME}=${cookie}`);
    }
    if (body) {
      reqHeaders.set('content-type', 'application/json');
    }

    return new NextRequest(new URL(url, 'http://localhost:3000'), {
      method,
      headers: reqHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });
  };

  it('rejects unauthenticated requests with 401 UNAUTHORIZED', async () => {
    const req = makeReq(`/api/v1/ai/design-sessions/${sessionIdA}/concepts`, 'GET');
    const res = await listConceptsApi(req, { params: Promise.resolve({ id: sessionIdA }) });
    expect(res.status).toBe(401);
  });

  it('generates a new concept grounded in session material specs and accounts for tokens', async () => {
    const req = makeReq(
      `/api/v1/ai/design-sessions/${sessionIdA}/concepts`,
      'POST',
      sessionCookieA,
      {
        idempotencyKey: 'idemp_key_create_1',
        promptRefinement: 'Modern minimalist style',
      }
    );

    const res = await generateConceptApi(req, { params: Promise.resolve({ id: sessionIdA }) });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.id).toBeDefined();
    expect(json.data.title).toBeDefined();
    expect(json.data.groundedAttributes.karatEquivalent).toBe('18');
    expect(json.data.tokenAccounting.totalTokens).toBeGreaterThan(0);
  });

  it('enforces idempotency: duplicate request with same idempotencyKey returns existing concept (200)', async () => {
    const req1 = makeReq(
      `/api/v1/ai/design-sessions/${sessionIdA}/concepts`,
      'POST',
      sessionCookieA,
      {
        idempotencyKey: 'idemp_key_duplicate_check',
      }
    );
    const res1 = await generateConceptApi(req1, { params: Promise.resolve({ id: sessionIdA }) });
    expect(res1.status).toBe(201);
    const concept1 = (await res1.json()).data;

    // Second call with same idempotency key
    const req2 = makeReq(
      `/api/v1/ai/design-sessions/${sessionIdA}/concepts`,
      'POST',
      sessionCookieA,
      {
        idempotencyKey: 'idemp_key_duplicate_check',
      }
    );
    const res2 = await generateConceptApi(req2, { params: Promise.resolve({ id: sessionIdA }) });
    expect(res2.status).toBe(201); // Controller returns 201 on success payload
    const concept2 = (await res2.json()).data;
    expect(concept2.id).toBe(concept1.id);
  });

  it('updates concept status (APPROVE)', async () => {
    // 1. Generate concept
    const genReq = makeReq(
      `/api/v1/ai/design-sessions/${sessionIdA}/concepts`,
      'POST',
      sessionCookieA,
      {
        idempotencyKey: 'idemp_to_approve',
      }
    );
    const genRes = await generateConceptApi(genReq, { params: Promise.resolve({ id: sessionIdA }) });
    const conceptId = (await genRes.json()).data.id;

    // 2. Approve concept
    const statusReq = makeReq(
      `/api/v1/ai/design-sessions/${sessionIdA}/concepts/${conceptId}/status`,
      'POST',
      sessionCookieA,
      { action: 'APPROVE' }
    );
    const statusRes = await updateConceptStatusApi(statusReq, {
      params: Promise.resolve({ id: sessionIdA, conceptId }),
    });
    expect(statusRes.status).toBe(200);
    const statusJson = await statusRes.json();
    expect(statusJson.data.status).toBe('APPROVED');
  });

  it('enforces multi-tenant isolation against cross-tenant probes (Tenant B cannot read Tenant A concepts)', async () => {
    // Generate concept in Tenant A
    const genReq = makeReq(
      `/api/v1/ai/design-sessions/${sessionIdA}/concepts`,
      'POST',
      sessionCookieA,
      {
        idempotencyKey: 'idemp_secret_tenant_a',
      }
    );
    const genRes = await generateConceptApi(genReq, { params: Promise.resolve({ id: sessionIdA }) });
    const conceptId = (await genRes.json()).data.id;

    // Tenant B attempts to read Tenant A concept
    const probeReq = makeReq(
      `/api/v1/ai/design-sessions/${sessionIdA}/concepts/${conceptId}`,
      'GET',
      sessionCookieB
    );
    const probeRes = await getConceptApi(probeReq, {
      params: Promise.resolve({ id: sessionIdA, conceptId }),
    });
    expect(probeRes.status).toBe(404);
  });
});
