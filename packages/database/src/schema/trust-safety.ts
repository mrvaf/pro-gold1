import { pgTable, varchar, timestamp, text, integer, boolean, real } from 'drizzle-orm/pg-core';
import { tenantsTable } from './tenants.js';
import { sellerProfilesTable } from './seller-profiles.js';

export const guildLicensesTable = pgTable('guild_licenses', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 })
    .notNull()
    .references(() => tenantsTable.id, { onDelete: 'cascade' }),
  sellerProfileId: varchar('seller_profile_id', { length: 64 })
    .notNull()
    .references(() => sellerProfilesTable.id, { onDelete: 'cascade' }),
  guildRegistrationNumber: varchar('guild_registration_number', { length: 128 }).notNull(),
  guildName: varchar('guild_name', { length: 255 }).notNull(),
  issuanceDate: timestamp('issuance_date', { withTimezone: true }).notNull(),
  expiryDate: timestamp('expiry_date', { withTimezone: true }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('PENDING'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  rejectedReason: text('rejected_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const hallmarkAuditRecordsTable = pgTable('hallmark_audit_records', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 })
    .notNull()
    .references(() => tenantsTable.id, { onDelete: 'cascade' }),
  inventoryItemId: varchar('inventory_item_id', { length: 64 }),
  productVariantId: varchar('product_variant_id', { length: 64 }),
  hallmarkCode: varchar('hallmark_code', { length: 64 }).notNull(),
  labAuthority: varchar('lab_authority', { length: 255 }).notNull(),
  verifiedFineness: real('verified_fineness').notNull(),
  auditNotes: text('audit_notes'),
  auditedAt: timestamp('audited_at', { withTimezone: true }).notNull().defaultNow(),
});

export const customerReviewsTable = pgTable('customer_reviews', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 })
    .notNull()
    .references(() => tenantsTable.id, { onDelete: 'cascade' }),
  orderId: varchar('order_id', { length: 64 }).notNull(),
  customerId: varchar('customer_id', { length: 64 }).notNull(),
  sellerProfileId: varchar('seller_profile_id', { length: 64 })
    .notNull()
    .references(() => sellerProfilesTable.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  comment: text('comment').notNull(),
  isVerifiedPurchase: boolean('is_verified_purchase').notNull().default(true),
  moderationStatus: varchar('moderation_status', { length: 32 }).notNull().default('PENDING_REVIEW'),
  moderationNotes: text('moderation_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
