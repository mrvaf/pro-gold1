import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as createRfqRoute } from '../apps/web/app/api/v1/rfq/route';
import { GET as getRfqRoute } from '../apps/web/app/api/v1/rfq/[id]/route';
import {
  POST as submitProposalRoute,
  PATCH as acceptProposalRoute,
} from '../apps/web/app/api/v1/rfq/[id]/proposals/route';
import { POST as postMessageRoute } from '../apps/web/app/api/v1/rfq/[id]/messages/route';
import {
  Tenant,
  User,
  Email,
  PasswordHash,
  TenantMembership,
  Session,
  createEntityId,
  type TenantId,
  type UserId,
} from '@v-gold/core';
import { getDefaultAuthService } from '../apps/web/lib/auth/auth.service.js';
import { SESSION_COOKIE_NAME } from '../apps/web/lib/auth/session-cookie.js';
import { getRfqContainer } from '../apps/web/lib/rfq/rfq-container.js';

describe('Stage 15 Custom Manufacturing & RFQ API Integration Tests', () => {
  let customerSessionCookie: string;
  let goldsmithSessionCookie: string;
  const tenantId = createEntityId<TenantId>('tenant_api_rfq_test');
  const customerId = createEntityId<UserId>('cust_rfq_test');
  const goldsmithId = createEntityId<UserId>('gold_rfq_test');

  beforeAll(async () => {
    const authService = getDefaultAuthService();

    // 1. Setup tenant
    const tenant = Tenant.create({
      id: tenantId,
      name: 'API RFQ Test Tenant',
      slug: 'api-rfq-test',
    }).unwrap();
    await authService.tenantRepository.save(tenant);

    // 2. Setup customer
    const customer = User.create({
      id: customerId,
      email: Email.create('customer-rfq@vgold.test').unwrap(),
      passwordHash: PasswordHash.create('$2b$10$abcdefghijklmnopqrstuvwxyz123456').unwrap(),
      displayName: 'Customer Sarah',
    }).unwrap();
    await authService.userRepository.save(customer);

    const custMembership = TenantMembership.create({
      tenantId,
      userId: customer.id,
      role: 'OWNER',
    }).unwrap();
    await authService.membershipRepository.save(custMembership);

    const custSession = Session.create({ id: 'e5'.repeat(32), userId: customer.id }).unwrap();
    await authService.sessionRepository.save(custSession);
    customerSessionCookie = `${SESSION_COOKIE_NAME}=${custSession.id}`;

    // 3. Setup goldsmith
    const goldsmith = User.create({
      id: goldsmithId,
      email: Email.create('goldsmith-rfq@vgold.test').unwrap(),
      passwordHash: PasswordHash.create('$2b$10$abcdefghijklmnopqrstuvwxyz123456').unwrap(),
      displayName: 'Goldsmith Reza',
    }).unwrap();
    await authService.userRepository.save(goldsmith);

    const goldMembership = TenantMembership.create({
      tenantId,
      userId: goldsmith.id,
      role: 'ADMIN',
    }).unwrap();
    await authService.membershipRepository.save(goldMembership);

    const goldSession = Session.create({ id: 'f6'.repeat(32), userId: goldsmith.id }).unwrap();
    await authService.sessionRepository.save(goldSession);
    goldsmithSessionCookie = `${SESSION_COOKIE_NAME}=${goldSession.id}`;
  });

  it('executes full RFQ workflow: creation, proposal submission, proposal acceptance, and in-band messaging', async () => {
    // 1. Customer creates RFQ
    const createReq = new NextRequest('http://localhost:3000/api/v1/rfq', {
      method: 'POST',
      headers: {
        cookie: customerSessionCookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Custom Diamond Solitaire Ring',
        description: 'Bespoke platinum engagement ring',
        jewelryType: 'RING',
        targetMetal: 'PLATINUM',
        estimatedWeightGrams: '6.5',
        targetBudget: '2500.00',
        currency: 'USD',
      }),
    });

    const createRes = await createRfqRoute(createReq);
    expect(createRes.status).toBe(201);
    const createData = await createRes.json();
    expect(createData.success).toBe(true);
    expect(createData.rfq.id).toBeDefined();
    expect(createData.rfq.status).toBe('OPEN');

    const rfqId = createData.rfq.id;

    // 2. Goldsmith submits proposal
    const propReq = new NextRequest(`http://localhost:3000/api/v1/rfq/${rfqId}/proposals`, {
      method: 'POST',
      headers: {
        cookie: goldsmithSessionCookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        goldsmithName: 'Goldsmith Reza',
        estimatedDays: 10,
        totalQuoteAmount: '2400.00',
        currency: 'USD',
        notes: 'Handmade precision bezel setting',
        milestones: [
          {
            milestoneId: 'm1',
            title: 'CAD & 3D Print',
            description: 'Customer review and resin print',
            targetDays: 3,
            costAmount: '600.00',
          },
          {
            milestoneId: 'm2',
            title: 'Platinum Casting & Polishing',
            description: 'Final platinum mount and setting',
            targetDays: 7,
            costAmount: '1800.00',
          },
        ],
      }),
    });

    const propRes = await submitProposalRoute(propReq, { params: Promise.resolve({ id: rfqId }) });
    expect(propRes.status).toBe(201);
    const propData = await propRes.json();
    expect(propData.success).toBe(true);
    expect(propData.proposal.id).toBeDefined();

    const proposalId = propData.proposal.id;

    // 3. Customer accepts proposal
    const acceptReq = new NextRequest(`http://localhost:3000/api/v1/rfq/${rfqId}/proposals`, {
      method: 'PATCH',
      headers: {
        cookie: customerSessionCookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        proposalId,
      }),
    });

    const acceptRes = await acceptProposalRoute(acceptReq, { params: Promise.resolve({ id: rfqId }) });
    expect(acceptRes.status).toBe(200);
    const acceptData = await acceptRes.json();
    expect(acceptData.success).toBe(true);
    expect(acceptData.rfq.status).toBe('ACCEPTED');
    expect(acceptData.rfq.assignedGoldsmithId).toBe(goldsmithId);

    // 4. In-band messaging
    const msgReq = new NextRequest(`http://localhost:3000/api/v1/rfq/${rfqId}/messages`, {
      method: 'POST',
      headers: {
        cookie: customerSessionCookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        senderRole: 'CUSTOMER',
        content: 'Proposal accepted! Excited to get started.',
      }),
    });

    const msgRes = await postMessageRoute(msgReq, { params: Promise.resolve({ id: rfqId }) });
    expect(msgRes.status).toBe(201);
    const msgData = await msgRes.json();
    expect(msgData.success).toBe(true);
    expect(msgData.message.content).toContain('Proposal accepted');

    // 5. Query updated RFQ
    const getReq = new NextRequest(`http://localhost:3000/api/v1/rfq/${rfqId}`, {
      method: 'GET',
      headers: {
        cookie: customerSessionCookie,
      },
    });

    const getRes = await getRfqRoute(getReq, { params: Promise.resolve({ id: rfqId }) });
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.rfq.status).toBe('ACCEPTED');
    expect(getData.rfq.messages.length).toBe(1);
    expect(getData.rfq.proposals[0].status).toBe('ACCEPTED');
  });
});
