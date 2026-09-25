import { NextResponse, type NextRequest } from 'next/server';
import type { MarketInstrument } from '@v-gold/core';
import { getMarketDataContainer } from '@/lib/market-data/market-data-container';
import { rejectIdentityInput } from '@/lib/api/api-errors';

export async function GET(): Promise<NextResponse>;
export async function GET(req: NextRequest): Promise<NextResponse>;
export async function GET(req?: NextRequest): Promise<NextResponse> {
  if (req) {
    const identityViolation = rejectIdentityInput(req);
    if (identityViolation) {
      return identityViolation;
    }
  }

  const container = getMarketDataContainer();
  const instruments = await container.instrumentRepo.findAllActive();

  return NextResponse.json({
    instruments: instruments.map((inst: MarketInstrument) => inst.toDto()),
  });
}
