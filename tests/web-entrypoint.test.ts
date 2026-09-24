import { describe, expect, it } from 'vitest';
import { GET as healthHandler } from '../apps/web/app/api/health/route.js';

describe('Web Application Entrypoint & Health Contract', () => {
  it('health endpoint returns 200 OK with proper system metadata', async () => {
    const response = await healthHandler();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('v-gold-web');
    expect(body.stage).toBe(1);
    expect(body.components.core).toBe('healthy');
    expect(body.components.aiGateway).toBe('healthy');
    expect(body.components.databaseConfig).toBe('configured');
    expect(body.timestamp).toBeDefined();
  });
});
