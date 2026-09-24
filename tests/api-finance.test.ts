import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getCurrencies } from '../apps/web/app/api/v1/finance/currencies/route';
import { GET as getFxRates } from '../apps/web/app/api/v1/finance/fx-rates/route';

describe('Financial APIs (Currencies & FX Rates)', () => {
  it('GET /api/v1/finance/currencies returns canonical currencies and Toman/Rial semantics', async () => {
    const response = await getCurrencies();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.currencies).toBeDefined();
    expect(Array.isArray(json.currencies)).toBe(true);

    const codes = json.currencies.map((c: any) => c.code);
    expect(codes).toContain('IRR');
    expect(codes).toContain('TOMAN');
    expect(codes).toContain('USD');
    expect(codes).toContain('EUR');

    expect(json.semantics.canonicalRatio.tomanToIrr).toBe('10');
  });

  it('GET /api/v1/finance/fx-rates returns authoritative rate for valid pair', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/finance/fx-rates?base=USD&quote=IRR');
    const response = await getFxRates(req);

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.fxRate).toBeDefined();
    expect(json.fxRate.baseCurrency).toBe('USD');
    expect(json.fxRate.quoteCurrency).toBe('IRR');
    expect(json.fxRate.rate).toBe('600000');
    expect(json.fxRate.direction).toBe('1 USD = 600000 IRR');

    // No secrets or credentials leaked
    expect(json.fxRate.apiKey).toBeUndefined();
    expect(json.fxRate.secret).toBeUndefined();
  });

  it('GET /api/v1/finance/fx-rates returns 400 when missing query parameters', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/finance/fx-rates');
    const response = await getFxRates(req);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /api/v1/finance/fx-rates returns 400 for unsupported currency code', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/finance/fx-rates?base=USD&quote=XYZ');
    const response = await getFxRates(req);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.code).toBe('INVALID_QUOTE_CURRENCY');
  });
});
