import { describe, it, expect } from 'vitest';
import { buildSecurityHeaders } from '../packages/core/src/common/security-headers.js';
import { InMemoryRateLimiter } from '../packages/core/src/common/rate-limiter.js';

describe('Stage 23 — Security Hardening & Penetration Audit Tests', () => {
  describe('HTTP Security Headers Builder', () => {
    it('sets essential defense-in-depth headers for XSS, frame injection, MIME sniffing', () => {
      const headers = buildSecurityHeaders({ isProduction: true });

      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['X-Frame-Options']).toBe('DENY');
      expect(headers['X-XSS-Protection']).toBe('1; mode=block');
      expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
      expect(headers['Strict-Transport-Security']).toBe('max-age=63072000; includeSubDomains; preload');
      expect(headers['Content-Security-Policy']).toContain("default-src 'self'");
      expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    });

    it('allows customized Content-Security-Policy', () => {
      const customCsp = "default-src 'self' https://api.vgold.internal";
      const headers = buildSecurityHeaders({
        contentSecurityPolicy: customCsp,
        isProduction: false,
      });

      expect(headers['Content-Security-Policy']).toBe(customCsp);
      expect(headers['Strict-Transport-Security']).toBeUndefined();
    });
  });

  describe('Rate Limiter Protection (DoS & Brute-Force Defense)', () => {
    it('allows requests within threshold and consumes token counts', () => {
      const limiter = new InMemoryRateLimiter({ windowMs: 10_000, maxRequests: 3 });

      const res1 = limiter.consume('user-ip-1');
      expect(res1.allowed).toBe(true);
      expect(res1.remaining).toBe(2);

      const res2 = limiter.consume('user-ip-1');
      expect(res2.allowed).toBe(true);
      expect(res2.remaining).toBe(1);

      const res3 = limiter.consume('user-ip-1');
      expect(res3.allowed).toBe(true);
      expect(res3.remaining).toBe(0);

      // 4th request exceeds maxRequests
      const res4 = limiter.consume('user-ip-1');
      expect(res4.allowed).toBe(false);
      expect(res4.remaining).toBe(0);

      // Separate key is unaffected
      const resOther = limiter.consume('user-ip-2');
      expect(resOther.allowed).toBe(true);
      expect(resOther.remaining).toBe(2);
    });

    it('resets window after elapsed time', async () => {
      const limiter = new InMemoryRateLimiter({ windowMs: 20, maxRequests: 1 });

      expect(limiter.consume('key-temp').allowed).toBe(true);
      expect(limiter.consume('key-temp').allowed).toBe(false);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(limiter.consume('key-temp').allowed).toBe(true);
    });
  });
});
