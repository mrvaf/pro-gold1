import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getMarketDataContainer } from '@/lib/market-data/market-data-container';

const paramSchema = z.object({
  instrument: z.string().min(2).max(64),
});

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ instrument: string }> }
) {
  try {
    const rawParams = await context.params;
    const parseResult = paramSchema.safeParse(rawParams);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid instrument parameter.',
          },
        },
        { status: 400 }
      );
    }

    let symbolOrId = decodeURIComponent(parseResult.data.instrument).trim();
    // Support common URL substitutions like XAU-USD or XAU_USD for XAU/USD
    if (symbolOrId.includes('-') && !symbolOrId.startsWith('inst_')) {
      symbolOrId = symbolOrId.replace('-', '/');
    } else if (symbolOrId.includes('_') && !symbolOrId.startsWith('inst_')) {
      symbolOrId = symbolOrId.replace('_', '/');
    }

    const container = getMarketDataContainer();
    const result = await container.queryService.getLatestObservation(symbolOrId);

    if (result.isErr) {
      const err = result.error;
      return NextResponse.json(
        {
          error: {
            code: err.code,
            message: err.message,
          },
        },
        { status: err.httpStatus }
      );
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
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while querying market data.',
        },
      },
      { status: 500 }
    );
  }
}
