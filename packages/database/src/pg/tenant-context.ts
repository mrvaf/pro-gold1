import { sql } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';

/**
 * Stage 8.3 — ADR-0049: tenant context for PostgreSQL Row-Level Security.
 *
 * The transaction-local GUC `app.tenant_id` is the RLS enforcement key. When a
 * tenant context IS set, every tenant-scoped table is hard-isolated to that
 * tenant (USING / WITH CHECK). When it is NOT set, the policy deliberately
 * allows global reads and writes — matching the repository port contract in
 * which optional `tenantId` arguments mean "un-scoped probe / public discovery"
 * (cross-tenant existence probes behind 403/404, public marketplace listings,
 * login membership discovery, global counts).
 */
export const APP_TENANT_SETTING = 'app.tenant_id';

type ExecutableDb = PgDatabase<any, any, any>;

/**
 * Runs `fn` with `app.tenant_id` bound to `tenantId` for the duration of a
 * transaction (transaction-local `set_config(..., true)` — safe with pooling).
 * A `tenantId` of `undefined` runs un-scoped (public/global branch).
 */
export async function withTenantContext<T>(
  db: ExecutableDb,
  tenantId: string | undefined,
  fn: (db: ExecutableDb) => Promise<T>
): Promise<T> {
  if (tenantId === undefined) {
    return fn(db);
  }
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config(${APP_TENANT_SETTING}, ${tenantId}, true)`);
    return fn(tx as unknown as ExecutableDb);
  });
}
