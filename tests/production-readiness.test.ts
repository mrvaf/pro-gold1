import { describe, it, expect, vi } from 'vitest';
import { StructuredLogger } from '../packages/core/src/common/structured-logger.js';
import { GET as getLive } from '../apps/web/app/api/health/live/route.js';
import { GET as getReady } from '../apps/web/app/api/health/ready/route.js';

describe('Stage 24 — Production Readiness & Operations Tests', () => {
  describe('Structured JSON Logging', () => {
    it('formats log entries with metadata, tenantId, and context', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const logger = new StructuredLogger({ environment: 'test' });

      const entry = logger.info('Transaction processed', { orderId: 'ord-123' }, { tenantId: 'tenant-gold' });

      expect(entry.level).toBe('info');
      expect(entry.message).toBe('Transaction processed');
      expect(entry.context).toEqual({ environment: 'test', orderId: 'ord-123' });
      expect(entry.tenantId).toBe('tenant-gold');
      expect(entry.timestamp).toBeDefined();

      expect(consoleLogSpy).toHaveBeenCalled();
      consoleLogSpy.mockRestore();
    });

    it('emits errors via console.error with severity level', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logger = new StructuredLogger();

      const entry = logger.error('Database connection timed out');
      expect(entry.level).toBe('error');
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Health Probes (Liveness & Readiness)', () => {
    it('responds healthy for liveness probe (/api/health/live)', async () => {
      const mockReq: any = {
        url: 'http://localhost:3000/api/health/live',
        headers: new Headers(),
        nextUrl: new URL('http://localhost:3000/api/health/live'),
      };
      const res = await getLive(mockReq);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe('healthy');
      expect(json.probe).toBe('liveness');
      expect(json.uptime).toBeGreaterThanOrEqual(0);
    });

    it('responds ready with storage runtime details for readiness probe (/api/health/ready)', async () => {
      const mockReq: any = {
        url: 'http://localhost:3000/api/health/ready',
        headers: new Headers(),
        nextUrl: new URL('http://localhost:3000/api/health/ready'),
      };
      const res = await getReady(mockReq);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe('ready');
      expect(json.probe).toBe('readiness');
      expect(json.details.storage).toBeDefined();
      expect(json.details.heapUsedMb).toBeGreaterThan(0);
    });
  });
});
