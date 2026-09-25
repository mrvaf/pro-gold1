import { authenticateRequest } from '@/lib/auth/request-auth';
import {
  toErrorResponse,
  rejectIdentityInput,
} from '@/lib/api/api-errors';
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
      (w) =>
        w.grams !== undefined ||
        w.troyOunces !== undefined ||
        w.mesghal !== undefined ||
        w.carats !== undefined,
      {
        message:
          'At least one precious metal weight unit must be specified (grams, troyOunces, or mesghal).',
      }
    ),
  purity: z
    .object({
      fineness: z.string().optional(),
      karat: z.string().optional(),
    })
    .refine((p) => p.fineness !== undefined || p.karat !== undefined, {
      message: 'At least one purity metric must be specified (fineness or karat).',
    }),
  targetCurrency: z.enum(['IRR', 'TOMAN', 'USD', 'EUR']),
  instrumentSymbol: z.string().min(1, 'Instrument symbol is required (e.g. "XAU/USD", "XAU/IRR")'),
  ruleId: z.string().optional(),
  stoneValue: z.string().optional(),
  allowStaleMarketData: z.boolean().optional(),
  storeId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, 'pricing.read');
    if (!auth.ok) {
      return auth.response;
    }

    const rawBody = await req.json();
    const identityViolation = rejectIdentityInput(req, rawBody);
    if (identityViolation) {
      return identityViolation;
    }
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
      tenantId: auth.tenantId,
      storeId: data.storeId,
    });

    if (quoteResult.isErr) {
      return toErrorResponse(quoteResult.error);
    }

    return NextResponse.json(
      {
        success: true,
        data: quoteResult.value.toDto(),
      },
      { status: 200 }
    );
  } catch (error) {
    return toErrorResponse(error, 'api:v1/pricing/calculate');
  }
}
