import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createEntityId,
  type TenantId,
  type UserId,
  type RfqId,
  type RfqProposalId,
} from '@v-gold/core';
import { authenticateRequest } from '@/lib/auth/request-auth';
import { toErrorResponse, rejectIdentityInput } from '@/lib/api/api-errors';
import { getRfqContainer } from '@/lib/rfq/rfq-container';

const submitProposalSchema = z.object({
  goldsmithName: z.string().min(1, 'goldsmithName is required'),
  estimatedDays: z.number().int().positive(),
  totalQuoteAmount: z.string().min(1, 'totalQuoteAmount is required'),
  currency: z.enum(['IRR', 'TOMAN', 'USD', 'EUR']),
  notes: z.string().optional(),
  milestones: z.array(
    z.object({
      milestoneId: z.string().min(1),
      title: z.string().min(1),
      description: z.string().min(1),
      targetDays: z.number().int().positive(),
      costAmount: z.string().min(1),
    })
  ),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req, 'catalog.read');
    if (!auth.ok) {
      return auth.response;
    }

    const { id: rfqId } = await params;
    const rawBody = await req.json();
    const identityViolation = rejectIdentityInput(req, rawBody);
    if (identityViolation) {
      return identityViolation;
    }

    const parseResult = submitProposalSchema.safeParse(rawBody);
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
    const container = getRfqContainer();

    const result = await container.rfqService.submitProposal({
      tenantId: createEntityId<TenantId>(auth.tenantId),
      rfqId: createEntityId<RfqId>(rfqId),
      goldsmithId: createEntityId<UserId>(auth.actorId),
      goldsmithName: data.goldsmithName,
      estimatedDays: data.estimatedDays,
      totalQuoteAmount: data.totalQuoteAmount,
      currency: data.currency,
      notes: data.notes,
      milestones: data.milestones,
    });

    if (result.isErr) {
      return toErrorResponse(result.error);
    }

    return NextResponse.json(
      {
        success: true,
        proposal: result.value.toDto(),
      },
      { status: 201 }
    );
  } catch (error) {
    return toErrorResponse(error, 'api:v1/rfq/[id]/proposals');
  }
}

const acceptProposalSchema = z.object({
  proposalId: z.string().min(1, 'proposalId is required'),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req, 'catalog.read');
    if (!auth.ok) {
      return auth.response;
    }

    const { id: rfqId } = await params;
    const rawBody = await req.json();
    const identityViolation = rejectIdentityInput(req, rawBody);
    if (identityViolation) {
      return identityViolation;
    }

    const parseResult = acceptProposalSchema.safeParse(rawBody);
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
    const container = getRfqContainer();

    const result = await container.rfqService.acceptProposal(
      createEntityId<RfqId>(rfqId),
      createEntityId<RfqProposalId>(data.proposalId),
      createEntityId<UserId>(auth.actorId),
      createEntityId<TenantId>(auth.tenantId)
    );

    if (result.isErr) {
      return toErrorResponse(result.error);
    }

    return NextResponse.json(
      {
        success: true,
        rfq: result.value.toDto(),
      },
      { status: 200 }
    );
  } catch (error) {
    return toErrorResponse(error, 'api:v1/rfq/[id]/proposals');
  }
}
