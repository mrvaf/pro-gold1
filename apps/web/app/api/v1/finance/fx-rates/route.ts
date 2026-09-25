import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { parseCurrencyCode } from '@v-gold/core';
import { getFinanceContainer } from '@/lib/finance/finance-container';
import {
  toErrorResponse,
  validationErrorResponse,
  rejectIdentityInput,
} from '@/lib/api/api-errors';

const querySchema = z.object({
  base: z.string().min(3).max(5),
  quote: z.string().min(3).max(5),
});

export async function GET(req: NextRequest) {
  try {
    const identityViolation = rejectIdentityInput(req);
    if (identityViolation) {
      return identityViolation;
    }

    const { searchParams } = new URL(req.url);
    const rawBase = searchParams.get('base');
    const rawQuote = searchParams.get('quote');

    const parseResult = querySchema.safeParse({ base: rawBase, quote: rawQuote });
    if (!parseResult.success) {
      return validationErrorResponse('Query parameters "base" and "quote" are required.');
    }

    const baseResult = parseCurrencyCode(parseResult.data.base);
    if (baseResult.isErr) {
      return toErrorResponse(baseResult.error, 'api:finance/fx-rates', 'INVALID_BASE_CURRENCY');
    }

    const quoteResult = parseCurrencyCode(parseResult.data.quote);
    if (quoteResult.isErr) {
      return toErrorResponse(quoteResult.error, 'api:finance/fx-rates', 'INVALID_QUOTE_CURRENCY');
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
  } catch (error) {
    return toErrorResponse(error, 'api:finance/fx-rates');
  }
}
