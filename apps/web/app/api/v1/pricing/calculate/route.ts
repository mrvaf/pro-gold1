import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPricingContainer } from '@/lib/pricing/pricing-container';
import type { CurrencyCode } from '@v-gold/core';

const calculateQuoteSchema = z.object({
  weight: z
    .object({
      grams: z.string().optional(),
      troyOunces: z.string().optional(),
      mesghal: z.string().optional(),
      carats: z.string().optional(),
    })
    .refine(
      (w) => w.grams !== undefined || w.troyOunces !== undefined || w.mesghal !== undefined || w.carats !== undefined,
      { message: 'At least one weight unit must be specified (grams, troyOunces, mesghal, or carats).' }
    ),
  purity: z
    .object({
      fineness: z.string().optional(),
      karat: z.string().optional(),
    })
    .refine(
      (p) => p.fineness !== undefined || p.karat !== undefined,
      { message: 'At least one purity metric must be specified (fineness or karat).' }
    ),
  targetCurrency: z.enum(['IRR', 'TOMAN', 'USD', 'EUR']),
  instrumentSymbol: z.string().min(1, 'Instrument symbol is required (e.g. "XAU/USD", "XAU/IRR")'),
  ruleId: z.string().optional(),
  stoneValue: z.string().optional(),
  allowStaleMarketData: z.boolean().optional(),
  tenantId: z.string().optional(),
  storeId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parseResult = calculateQuoteSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body schema.',
            details: parseResult.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const { data } = parseResult;
    const container = getPricingContainer();

    const quoteResult = await container.pricingService.calculateQuote({
      weightInput: data.weight,
      purityInput: data.purity,
      targetCurrency: data.targetCurrency as CurrencyCode,
      instrumentSymbol: data.instrumentSymbol,
      ruleId: data.ruleId,
      stoneValue: data.stoneValue,
      allowStaleMarketData: data.allowStaleMarketData,
      tenantId: data.tenantId,
      storeId: data.storeId,
    });

    if (quoteResult.isErr) {
      const err = quoteResult.error;
      return NextResponse.json(
        {
          success: false,
          error: {
            code: err.code,
            message: err.message,
          },
        },
        { status: err.httpStatus ?? 422 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: quoteResult.value.toDto(),
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error?.message ?? 'An unexpected error occurred during pricing calculation.',
        },
      },
      { status: 500 }
    );
  }
}
