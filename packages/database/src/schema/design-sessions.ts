import { pgTable, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { tenantsTable } from './tenants.js';
import { usersTable } from './users.js';

export const designSessionsTable = pgTable(
  'design_sessions',
  {
    id: varchar('id', { length: 128 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenantsTable.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 128 }).references(() => usersTable.id, {
      onDelete: 'set null',
    }),
    title: varchar('title', { length: 255 }).notNull().default('New Jewelry Design'),
    status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
    messagesJson: text('messages_json').notNull().default('[]'),
    extractedAttributesJson: text('extracted_attributes_json').notNull().default('{}'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdByActorType: varchar('created_by_actor_type', { length: 32 }).notNull().default('SYSTEM'),
    createdByActorId: varchar('created_by_actor_id', { length: 128 }).notNull().default('system'),
    updatedByActorType: varchar('updated_by_actor_type', { length: 32 }).notNull().default('SYSTEM'),
    updatedByActorId: varchar('updated_by_actor_id', { length: 128 }).notNull().default('system'),
  },
  (table) => [
    index('design_sessions_tenant_status_idx').on(table.tenantId, table.status),
    index('design_sessions_user_idx').on(table.userId),
    index('design_sessions_tenant_updated_idx').on(table.tenantId, table.updatedAt),
  ]
);

export type DesignSessionRecord = typeof designSessionsTable.$inferSelect;
export type InsertDesignSessionRecord = typeof designSessionsTable.$inferInsert;
