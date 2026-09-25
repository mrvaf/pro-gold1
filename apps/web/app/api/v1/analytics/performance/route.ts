import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/request-auth';
import { toErrorResponse } from '@/lib/api/api-errors';
import { getAnalyticsService } from '@/lib/analytics/analytics-container';

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, 'tenant.read');
    if (!auth.ok) {
      return auth.response;
    }

    const { searchParams } = new URL(req.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    const periodStart = fromParam ? new Date(fromParam) : undefined;
    const periodEnd = toParam ? new Date(toParam) : undefined;

    if (periodStart && isNaN(periodStart.getTime())) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: 'Invalid "from" ISO date parameter' },
        { status: 400 }
      );
    }
    if (periodEnd && isNaN(periodEnd.getTime())) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: 'Invalid "to" ISO date parameter' },
        { status: 400 }
      );
    }

    const service = getAnalyticsService();
    const dashboard = await service.getPerformanceDashboard({
      tenantId: auth.tenantId,
      periodStart,
      periodEnd,
    });

    return NextResponse.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    return toErrorResponse(error, 'api:v1/analytics/performance:GET');
  }
}
