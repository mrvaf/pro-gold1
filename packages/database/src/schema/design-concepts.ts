import { pgTable, varchar, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenantsTable } from './tenants.js';
import { designSessionsTable } from './design-sessions.js';

export const designConceptsTable = pgTable(
  'design_concepts',
  {
    id: varchar('id', { length: 128 }).primaryKey(),
    sessionId: varchar('session_id', { length: 128 })
      .notNull()
      .references(() => designSessionsTable.id, { onDelete: 'cascade' }),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenantsTable.id, { onDelete: 'cascade' }),
    idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description').notNull().default(''),
    promptRefinement: text('prompt_refinement').notNull().default(''),
    visualPrompt: text('visual_prompt').notNull().default(''),
    groundedAttributesJson: text('grounded_attributes_json').notNull().default('{}'),
    tokenAccountingJson: text('token_accounting_json').notNull().default('{}'),
    status: varchar('status', { length: 32 }).notNull().default('GENERATED'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdByActorType: varchar('created_by_actor_type', { length: 32 }).notNull().default('SYSTEM'),
    createdByActorId: varchar('created_by_actor_id', { length: 128 }).notNull().default('system'),
    updatedByActorType: varchar('updated_by_actor_type', { length: 32 }).notNull().default('SYSTEM'),
    updatedByActorId: varchar('updated_by_actor_id', { length: 128 }).notNull().default('system'),
  },
  (table) => [
    uniqueIndex('design_concepts_idempotency_uniq').on(
      table.tenantId,
      table.sessionId,
      table.idempotencyKey
    ),
    index('design_concepts_session_idx').on(table.sessionId),
    index('design_concepts_tenant_status_idx').on(table.tenantId, table.status),
  ]
);

export type DesignConceptRecord = typeof designConceptsTable.$inferSelect;
export type InsertDesignConceptRecord = typeof designConceptsTable.$inferInsert;
