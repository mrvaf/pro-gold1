import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getMarketDataContainer } from '@/lib/market-data/market-data-container';
import {
  toErrorResponse,
  validationErrorResponse,
  rejectIdentityInput,
} from '@/lib/api/api-errors';

const querySchema = z.object({
  symbol: z.string().min(2).max(64),
});

export async function GET(req: NextRequest) {
  try {
    const identityViolation = rejectIdentityInput(req);
    if (identityViolation) {
      return identityViolation;
    }

    const { searchParams } = new URL(req.url);
    const rawSymbol = searchParams.get('symbol');

    const parseResult = querySchema.safeParse({ symbol: rawSymbol });
    if (!parseResult.success) {
      return validationErrorResponse('Query parameter "symbol" is required.');
    }

    let symbolOrId = decodeURIComponent(parseResult.data.symbol).trim();
    if (symbolOrId.includes('-') && !symbolOrId.startsWith('inst_')) {
      symbolOrId = symbolOrId.replace('-', '/');
    }

    const container = getMarketDataContainer();
    const result = await container.queryService.getLatestObservation(symbolOrId);

    if (result.isErr) {
      return toErrorResponse(result.error);
    }

    const { instrument, source, observation, status, ageMs } = result.value;

    return NextResponse.json({
      instrument: {
        id: instrument.id,
        symbol: instrument.symbol,
        baseAsset: instrument.baseAsset,
        quoteCurrency: instrument.quoteCurrency,
        unit: instrument.unit,
        displayName: instrument.displayName,
      },
      source: {
        id: source.id,
        name: source.name,
        code: source.code,
      },
      observation: {
        id: observation.id,
        amount: observation.price.amount.toString(),
        bid: observation.price.bid?.toString() ?? null,
        ask: observation.price.ask?.toString() ?? null,
        spread: observation.price.spread?.toString() ?? null,
        currency: observation.price.currency,
        unit: observation.price.unit,
        quality: observation.quality,
        observedAt: observation.observedAt.toISOString(),
        ingestedAt: observation.ingestedAt.toISOString(),
      },
      status,
      ageMs,
    });
  } catch (error) {
    return toErrorResponse(error, 'api:market-data/latest');
  }
}
