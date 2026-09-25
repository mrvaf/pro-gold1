import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as analyticsGet } from '@/app/api/v1/analytics/performance/route';
import * as authModule from '@/lib/auth/request-auth';

describe('Stage 21 — Analytics & Business Intelligence REST API', () => {
  it('returns seller performance dashboard for authenticated tenant', async () => {
    vi.spyOn(authModule, 'authenticateRequest').mockResolvedValue({
      ok: true,
      tenantId: 'tenant_analytics_api_1',
      actorId: 'usr_an_1',
      identity: {} as any,
      membership: {} as any,
    });

    const req = new NextRequest('http://localhost:3000/api/v1/analytics/performance');
    const res = await analyticsGet(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.tenantId).toBe('tenant_analytics_api_1');
    expect(json.data.revenue).toBeDefined();
    expect(json.data.inventory).toBeDefined();
    expect(json.data.inventory.turnoverRate).toBeDefined();
  });

  it('rejects invalid date filter parameters with 400', async () => {
    vi.spyOn(authModule, 'authenticateRequest').mockResolvedValue({
      ok: true,
      tenantId: 'tenant_analytics_api_1',
      actorId: 'usr_an_1',
      identity: {} as any,
      membership: {} as any,
    });

    const req = new NextRequest('http://localhost:3000/api/v1/analytics/performance?from=invalid-date');
    const res = await analyticsGet(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe('VALIDATION_ERROR');
  });
});
