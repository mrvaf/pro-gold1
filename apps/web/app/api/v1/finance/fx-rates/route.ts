import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { parseCurrencyCode } from '@v-gold/core';
import { getFinanceContainer } from '@/lib/finance/finance-container';

const querySchema = z.object({
  base: z.string().min(3).max(5),
  quote: z.string().min(3).max(5),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawBase = searchParams.get('base');
    const rawQuote = searchParams.get('quote');

    const parseResult = querySchema.safeParse({ base: rawBase, quote: rawQuote });
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Query parameters "base" and "quote" are required.',
          },
        },
        { status: 400 }
      );
    }

    const baseResult = parseCurrencyCode(parseResult.data.base);
    if (baseResult.isErr) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_BASE_CURRENCY',
            message: baseResult.error.message,
          },
        },
        { status: 400 }
      );
    }

    const quoteResult = parseCurrencyCode(parseResult.data.quote);
    if (quoteResult.isErr) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_QUOTE_CURRENCY',
            message: quoteResult.error.message,
          },
        },
        { status: 400 }
      );
    }

    const container = getFinanceContainer();
    const rate = await container.fxRateRepo.findLatest(baseResult.value, quoteResult.value);

    if (!rate) {
      return NextResponse.json(
        {
          error: {
            code: 'FX_RATE_NOT_FOUND',
            message: `No exchange rate found for currency pair ${baseResult.value}/${quoteResult.value}.`,
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      fxRate: rate.toDto(),
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while querying FX rates.',
        },
      },
      { status: 500 }
    );
  }
}
