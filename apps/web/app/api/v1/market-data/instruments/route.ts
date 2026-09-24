import { NextResponse } from 'next/server';
import type { MarketInstrument } from '@v-gold/core';
import { getMarketDataContainer } from '@/lib/market-data/market-data-container';

export async function GET() {
  const container = getMarketDataContainer();
  const instruments = await container.instrumentRepo.findAllActive();

  return NextResponse.json({
    instruments: instruments.map((inst: MarketInstrument) => inst.toDto()),
  });
}
