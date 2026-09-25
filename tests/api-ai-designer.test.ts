import { describe, expect, it, beforeAll } from 'vitest';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import {
  Tenant,
  User,
  Email,
  PasswordHash,
  TenantMembership,
  createEntityId,
  type TenantId,
  Session,
} from '@v-gold/core';
import { getDefaultAuthService } from '../apps/web/lib/auth/auth.service.js';
import { SESSION_COOKIE_NAME } from '../apps/web/lib/auth/session-cookie.js';
import {
  getDesignSessionContainer,
  setDesignSessionContainer,
} from '../apps/web/lib/ai-designer/design-session-container.js';
import { DesignSessionService } from '../apps/web/lib/ai-designer/design-session-service.js';
import { InMemoryDesignSessionRepository } from '@v-gold/database';
import { MockAiGatewayAdapter } from '@v-gold/ai-gateway';

import {
  GET as listSessionsApi,
  POST as createSessionApi,
} from '../apps/web/app/api/v1/ai/design-sessions/route.js';
import { GET as getSessionApi } from '../apps/web/app/api/v1/ai/design-sessions/[id]/route.js';
import { POST as addMessageApi } from '../apps/web/app/api/v1/ai/design-sessions/[id]/messages/route.js';
import { POST as completeSessionApi } from '../apps/web/app/api/v1/ai/design-sessions/[id]/complete/route.js';

describe('Stage 9 — AI Conversational Designer API & Auth Hardening', () => {
  const tenantAId = createEntityId<TenantId>('tenant_ai_a');
  const tenantBId = createEntityId<TenantId>('tenant_ai_b');

  let sessionCookieA: string;
  let sessionCookieB: string;
  let designRepo: InMemoryDesignSessionRepository;

  beforeAll(async () => {
    const authService = getDefaultAuthService();

    // 1. Create tenants
    const tenantA = Tenant.create({ id: tenantAId, name: 'Tenant A', slug: 'tenant-a' }).unwrap();
    const tenantB = Tenant.create({ id: tenantBId, name: 'Tenant B', slug: 'tenant-b' }).unwrap();
    await authService.tenantRepository.save(tenantA);
    await authService.tenantRepository.save(tenantB);

    // 2. Create users
    const userA = User.create({
      id: 'user_ai_a',
      email: Email.create('user_ai_a@vgold.test').unwrap(),
      displayName: 'User AI A',
      passwordHash: PasswordHash.create('$2b$10$abcdefghijklmnopqrstuvwxyz123456').unwrap(),
    }).unwrap();

    const userB = User.create({
      id: 'user_ai_b',
      email: Email.create('user_ai_b@vgold.test').unwrap(),
      displayName: 'User AI B',
      passwordHash: PasswordHash.create('$2b$10$abcdefghijklmnopqrstuvwxyz123456').unwrap(),
    }).unwrap();

    await authService.userRepository.save(userA);
    await authService.userRepository.save(userB);

    // 3. Create memberships (OWNER has all permissions including ai.design)
    const memA = TenantMembership.create({
      tenantId: tenantAId,
      userId: userA.id,
      role: 'OWNER',
    }).unwrap();

    const memB = TenantMembership.create({
      tenantId: tenantBId,
      userId: userB.id,
      role: 'OWNER',
    }).unwrap();

    await authService.membershipRepository.save(memA);
    await authService.membershipRepository.save(memB);

    // 4. Create sessions
    sessionCookieA = crypto.randomBytes(32).toString('hex');
    sessionCookieB = crypto.randomBytes(32).toString('hex');

    const sA = Session.create({
      id: sessionCookieA,
      userId: userA.id,
    }).unwrap();

    const sB = Session.create({
      id: sessionCookieB,
      userId: userB.id,
    }).unwrap();

    await authService.sessionRepository.save(sA);
    await authService.sessionRepository.save(sB);

    // Setup isolated test container with Mock AI adapter
    designRepo = new InMemoryDesignSessionRepository();
    const mockAi = new MockAiGatewayAdapter();
    const service = new DesignSessionService(designRepo, mockAi);

    setDesignSessionContainer({
      sessionRepo: designRepo,
      aiGateway: mockAi,
      designSessionService: service,
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
    const req = makeReq('/api/v1/ai/design-sessions', 'GET');
    const res = await listSessionsApi(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects client-supplied identity input with 400 VALIDATION_ERROR (ADR-0041)', async () => {
    const req = makeReq(
      '/api/v1/ai/design-sessions',
      'POST',
      sessionCookieA,
      {
        title: 'Ring Design',
        tenantId: 'spoofed_tenant',
      }
    );
    const res = await createSessionApi(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(json.error.message).toContain('Client-supplied identity field "tenantId" is not accepted');
  });

  it('creates a new design session and automatically extracts initial attributes via AI', async () => {
    const req = makeReq(
      '/api/v1/ai/design-sessions',
      'POST',
      sessionCookieA,
      {
        title: 'Custom Diamond Engagement Ring',
        initialMessage: 'I want an 18K yellow gold engagement ring with a round diamond.',
      }
    );
    const res = await createSessionApi(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.id).toBeDefined();
    expect(json.data.tenantId).toBe(tenantAId);
    expect(json.data.title).toBe('Custom Diamond Engagement Ring');
    expect(json.data.messages.length).toBe(2); // Initial user message + AI assistant reply
    expect(json.data.messages[0].role).toBe('USER');
    expect(json.data.messages[1].role).toBe('ASSISTANT');
    expect(json.data.extractedAttributes.jewelryType).toBe('RING');
    expect(json.data.extractedAttributes.metalType).toBe('GOLD');
  });

  it('adds user messages and extracts incremental design attributes', async () => {
    // 1. Create session
    const createReq = makeReq('/api/v1/ai/design-sessions', 'POST', sessionCookieA, {
      title: 'Solitaire Ring',
    });
    const createRes = await createSessionApi(createReq);
    const session = (await createRes.json()).data;

    // 2. Add message
    const msgReq = makeReq(
      `/api/v1/ai/design-sessions/${session.id}/messages`,
      'POST',
      sessionCookieA,
      {
        content: 'Please make it for an anniversary occasion.',
      }
    );
    const msgRes = await addMessageApi(msgReq, { params: Promise.resolve({ id: session.id }) });
    expect(msgRes.status).toBe(200);
    const msgJson = await msgRes.json();
    expect(msgJson.data.messages.length).toBe(2); // user + assistant
    expect(msgJson.data.extractedAttributes.occasion).toBe('ENGAGEMENT'); // Mock adapter default
  });

  it('enforces multi-tenant isolation against cross-tenant probes (Tenant B cannot read Tenant A session)', async () => {
    // 1. Create session for Tenant A
    const createReq = makeReq('/api/v1/ai/design-sessions', 'POST', sessionCookieA, {
      title: 'Tenant A Secret Design',
    });
    const session = (await (await createSessionApi(createReq)).json()).data;

    // 2. Tenant B tries to fetch Tenant A session
    const probeReq = makeReq(
      `/api/v1/ai/design-sessions/${session.id}`,
      'GET',
      sessionCookieB
    );
    const probeRes = await getSessionApi(probeReq, { params: Promise.resolve({ id: session.id }) });
    expect(probeRes.status).toBe(404);
    const json = await probeRes.json();
    expect(json.error.code).toBe('DESIGN_SESSION_NOT_FOUND');
  });

  it('completes the design session and prevents subsequent additions', async () => {
    // 1. Create session
    const createReq = makeReq('/api/v1/ai/design-sessions', 'POST', sessionCookieA, {
      title: 'Session to Complete',
    });
    const session = (await (await createSessionApi(createReq)).json()).data;

    // 2. Complete session
    const compReq = makeReq(
      `/api/v1/ai/design-sessions/${session.id}/complete`,
      'POST',
      sessionCookieA
    );
    const compRes = await completeSessionApi(compReq, { params: Promise.resolve({ id: session.id }) });
    expect(compRes.status).toBe(200);
    expect((await compRes.json()).data.status).toBe('COMPLETED');

    // 3. Attempting to add message to completed session fails
    const failMsgReq = makeReq(
      `/api/v1/ai/design-sessions/${session.id}/messages`,
      'POST',
      sessionCookieA,
      {
        content: 'Another thought after completion...',
      }
    );
    const failRes = await addMessageApi(failMsgReq, { params: Promise.resolve({ id: session.id }) });
    expect(failRes.status).toBe(409);
    expect((await failRes.json()).error.code).toBe('INVALID_DESIGN_SESSION_STATE');
  });
});
