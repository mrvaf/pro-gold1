import { pgTable, varchar, numeric, timestamp, text, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenantsTable } from './tenants.js';
import { productsTable } from './products.js';
import { pricingRulesTable } from './pricing-rules.js';

export const productVariantsTable = pgTable(
  'product_variants',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    productId: varchar('product_id', { length: 64 })
      .notNull()
      .references(() => productsTable.id, { onDelete: 'cascade' }),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenantsTable.id, { onDelete: 'cascade' }),
    sku: varchar('sku', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
    pricingRuleId: varchar('pricing_rule_id', { length: 64 }).references(
      () => pricingRulesTable.id,
      { onDelete: 'set null' }
    ),
    jewelryType: varchar('jewelry_type', { length: 64 }).notNull(),
    metalType: varchar('metal_type', { length: 32 }).notNull().default('GOLD'),
    goldPurityFineness: numeric('gold_purity_fineness', { precision: 6, scale: 4 }).notNull(),
    goldPurityKarat: numeric('gold_purity_karat', { precision: 6, scale: 4 }).notNull(),
    goldWeightGrams: numeric('gold_weight_grams', { precision: 16, scale: 6 }).notNull(),
    grossWeightGrams: numeric('gross_weight_grams', { precision: 16, scale: 6 }).notNull(),
    gemstonesJson: text('gemstones_json'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdByActorId: varchar('created_by_actor_id', { length: 64 }),
    updatedByActorId: varchar('updated_by_actor_id', { length: 64 }),
  },
  (table) => [
    uniqueIndex('product_variants_tenant_sku_uniq').on(table.tenantId, table.sku),
    index('product_variants_product_id_idx').on(table.productId),
  ]
);

export type ProductVariantRecord = typeof productVariantsTable.$inferSelect;
export type InsertProductVariantRecord = typeof productVariantsTable.$inferInsert;
