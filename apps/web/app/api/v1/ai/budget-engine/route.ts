import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createEntityId, type TenantId } from '@v-gold/core';
import { authenticateRequest } from '@/lib/auth/request-auth';
import { toErrorResponse, rejectIdentityInput } from '@/lib/api/api-errors';
import { getBudgetEngineContainer } from '@/lib/budget-engine/budget-engine-container';

const solveBudgetSchema = z.object({
  budgetCeiling: z.string().min(1, 'budgetCeiling is required'),
  currency: z.enum(['IRR', 'TOMAN', 'USD', 'EUR']),
  instrumentSymbol: z.string().min(1, 'instrumentSymbol is required'),
  targetKarats: z.array(z.number().int().min(9).max(24)).optional(),
  ruleId: z.string().optional(),
  stoneAllowance: z.string().optional(),
  minWeightGrams: z.string().optional(),
  maxWeightGrams: z.string().optional(),
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

    const parseResult = solveBudgetSchema.safeParse(rawBody);
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
    const container = getBudgetEngineContainer();

    const result = await container.budgetEngineService.solveViableOptions({
      budgetCeilingAmount: data.budgetCeiling,
      currency: data.currency,
      instrumentSymbol: data.instrumentSymbol,
      targetKarats: data.targetKarats,
      ruleId: data.ruleId,
      stoneAllowanceAmount: data.stoneAllowance,
      minWeightGrams: data.minWeightGrams,
      maxWeightGrams: data.maxWeightGrams,
      allowStaleMarketData: data.allowStaleMarketData,
      tenantId: auth.tenantId ? createEntityId<TenantId>(auth.tenantId) : undefined,
      storeId: data.storeId as any,
    });

    if (result.isErr) {
      return toErrorResponse(result.error);
    }

    return NextResponse.json(
      {
        success: true,
        configurations: result.value.map((c) => c.toDto()),
        count: result.value.length,
      },
      { status: 200 }
    );
  } catch (error) {
    return toErrorResponse(error, 'api:v1/ai/budget-engine');
  }
}
