import { pgTable, varchar, timestamp } from 'drizzle-orm/pg-core';

export const tenantsTable = pgTable('tenants', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 128 }).notNull().unique(),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type TenantRecord = typeof tenantsTable.$inferSelect;
export type InsertTenantRecord = typeof tenantsTable.$inferInsert;
