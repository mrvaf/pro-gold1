import { pgTable, varchar, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenantsTable } from './tenants.js';
import { productsTable } from './products.js';

export const digitalJewelryPassports = pgTable(
  'digital_jewelry_passports',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenantsTable.id, { onDelete: 'cascade' }),
    productId: varchar('product_id', { length: 64 })
      .notNull()
      .references(() => productsTable.id, { onDelete: 'cascade' }),
    serialNumber: varchar('serial_number', { length: 128 }).notNull(),
    digitalCertificateNumber: varchar('digital_certificate_number', { length: 128 }).notNull(),
    styleDna: jsonb('style_dna').notNull(),
    provenanceHistory: jsonb('provenance_history').notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_passports_tenant').on(table.tenantId),
    index('idx_passports_product').on(table.tenantId, table.productId),
    uniqueIndex('idx_passports_serial').on(table.tenantId, table.serialNumber),
    uniqueIndex('idx_passports_certificate').on(table.tenantId, table.digitalCertificateNumber),
  ]
);
