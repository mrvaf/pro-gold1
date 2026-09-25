import { pgTable, varchar, timestamp, jsonb, boolean, integer } from 'drizzle-orm/pg-core';
import { tenantsTable } from './tenants.js';
import { usersTable } from './users.js';

export const cartsTable = pgTable('carts', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 })
    .notNull()
    .references(() => tenantsTable.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 64 })
    .references(() => usersTable.id, { onDelete: 'set null' }),
  currency: varchar('currency', { length: 10 }).notNull().default('USD'),
  items: jsonb('items').notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const ordersTable = pgTable('orders', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 })
    .notNull()
    .references(() => tenantsTable.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 64 })
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 32 }).notNull().default('PENDING_PAYMENT'),
  lines: jsonb('lines').notNull().default([]),
  currency: varchar('currency', { length: 10 }).notNull(),
  subtotal: jsonb('subtotal').notNull(),
  taxAmount: jsonb('tax_amount').notNull(),
  totalAmount: jsonb('total_amount').notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 128 }),
  paymentDetails: jsonb('payment_details'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const stockReservationsTable = pgTable('stock_reservations', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 })
    .notNull()
    .references(() => tenantsTable.id, { onDelete: 'cascade' }),
  orderId: varchar('order_id', { length: 64 }),
  sku: varchar('sku', { length: 64 }).notNull(),
  quantity: integer('quantity').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  isCommitted: boolean('is_committed').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
