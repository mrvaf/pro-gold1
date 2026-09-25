import { z } from 'zod';

export interface PaginationParams {
  readonly limit: number;
  readonly cursor?: string | undefined;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly nextCursor?: string | undefined;
  readonly hasMore: boolean;
  readonly totalCount?: number | undefined;
}

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export function parsePaginationParams(params: {
  limit?: string | number | null;
  cursor?: string | null;
}): PaginationParams {
  const parsed = paginationQuerySchema.parse({
    limit: params.limit ?? 20,
    cursor: params.cursor ?? undefined,
  });
  return {
    limit: parsed.limit,
    cursor: parsed.cursor,
  };
}

export function paginateArray<T extends { id: string }>(
  items: readonly T[],
  params: PaginationParams
): PaginatedResult<T> {
  const { limit, cursor } = params;
  let startIndex = 0;

  if (cursor) {
    const foundIndex = items.findIndex((item) => item.id === cursor);
    if (foundIndex !== -1) {
      startIndex = foundIndex + 1;
    }
  }

  const sliced = items.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < items.length;
  const nextCursor = hasMore && sliced.length > 0 ? sliced[sliced.length - 1]?.id : undefined;

  return {
    items: sliced,
    nextCursor,
    hasMore,
    totalCount: items.length,
  };
}
