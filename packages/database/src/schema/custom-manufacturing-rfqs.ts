import { pgTable, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { tenantsTable } from './tenants.js';
import { usersTable } from './users.js';

export const customManufacturingRfqsTable = pgTable(
  'custom_manufacturing_rfqs',
  {
    id: varchar('id', { length: 128 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenantsTable.id, { onDelete: 'cascade' }),
    customerId: varchar('customer_id', { length: 64 })
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    sellerId: varchar('seller_id', { length: 64 }).references(() => usersTable.id, {
      onDelete: 'set null',
    }),
    assignedGoldsmithId: varchar('assigned_goldsmith_id', { length: 64 }).references(
      () => usersTable.id,
      { onDelete: 'set null' }
    ),
    acceptedProposalId: varchar('accepted_proposal_id', { length: 128 }),
    status: varchar('status', { length: 32 }).notNull(),
    specificationJson: text('specification_json').notNull(),
    proposalsJson: text('proposals_json').notNull().default('[]'),
    messagesJson: text('messages_json').notNull().default('[]'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('custom_rfqs_tenant_idx').on(table.tenantId),
    index('custom_rfqs_customer_idx').on(table.customerId),
    index('custom_rfqs_status_idx').on(table.status),
  ]
);

export type CustomManufacturingRfqRecord = typeof customManufacturingRfqsTable.$inferSelect;
export type InsertCustomManufacturingRfqRecord = typeof customManufacturingRfqsTable.$inferInsert;
