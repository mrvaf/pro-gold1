import { pgTable, varchar, numeric, timestamp, integer, index } from 'drizzle-orm/pg-core';

export const pricingRulesTable = pgTable(
  'pricing_rules',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    name: varchar('name', { length: 128 }).notNull(),
    version: varchar('version', { length: 32 }).notNull().default('1'),
    tenantId: varchar('tenant_id', { length: 64 }),
    storeId: varchar('store_id', { length: 64 }),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    makingChargeType: varchar('making_charge_type', { length: 32 }).notNull(),
    makingChargeRate: numeric('making_charge_rate', { precision: 24, scale: 8 }).notNull(),
    marginType: varchar('margin_type', { length: 32 }).notNull(),
    marginRate: numeric('margin_rate', { precision: 24, scale: 8 }).notNull(),
    taxableBase: varchar('taxable_base', { length: 32 }).notNull(),
    taxRate: numeric('tax_rate', { precision: 24, scale: 8 }).notNull(),
    roundingMode: varchar('rounding_mode', { length: 32 }).notNull(),
    roundingScale: integer('rounding_scale'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
  },
  (table) => [
    index('pricing_rules_tenant_effective_idx').on(
      table.tenantId,
      table.effectiveFrom
    ),
    index('pricing_rules_id_ver_idx').on(table.id, table.version),
  ]
);

export type PricingRuleRecord = typeof pricingRulesTable.$inferSelect;
export type InsertPricingRuleRecord = typeof pricingRulesTable.$inferInsert;
