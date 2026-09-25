import { pgTable, varchar, timestamp, text, jsonb, boolean, integer } from 'drizzle-orm/pg-core';
import { tenantsTable } from './tenants.js';
import { productsTable } from './products.js';

export const packagingSpecificationsTable = pgTable('packaging_specifications', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 })
    .notNull()
    .references(() => tenantsTable.id, { onDelete: 'cascade' }),
  productId: varchar('product_id', { length: 64 })
    .references(() => productsTable.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  dimensions: jsonb('dimensions').notNull(),
  material: varchar('material', { length: 64 }).notNull(),
  tier: varchar('tier', { length: 64 }).notNull(),
  primaryColorHex: varchar('primary_color_hex', { length: 32 }).notNull(),
  accentColorHex: varchar('accent_color_hex', { length: 32 }),
  hasCustomDieline: boolean('has_custom_dieline').notNull().default(false),
  hasFoilEmbossing: boolean('has_foil_embossing').notNull().default(false),
  dieline: jsonb('dieline'),
  productionCost: jsonb('production_cost').notNull(),
  aiPreviewImageUrl: text('ai_preview_image_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
