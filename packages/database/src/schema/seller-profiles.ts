import { pgTable, varchar, text, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenantsTable } from './tenants.js';
import { storesTable } from './stores.js';

export const sellerProfilesTable = pgTable(
  'seller_profiles',
  {
    id: varchar('id', { length: 128 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenantsTable.id, { onDelete: 'cascade' }),
    storeId: varchar('store_id', { length: 64 }).references(() => storesTable.id, {
      onDelete: 'set null',
    }),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    bio: text('bio'),
    logoUrl: text('logo_url'),
    bannerUrl: text('banner_url'),
    isPubliclyVisible: boolean('is_publicly_visible').notNull().default(true),
    status: varchar('status', { length: 32 }).notNull().default('DRAFT'),
    businessRegistrationNumber: varchar('business_registration_number', { length: 100 }),
    taxId: varchar('tax_id', { length: 100 }),
    contactEmail: varchar('contact_email', { length: 255 }),
    contactPhone: varchar('contact_phone', { length: 50 }),
    metadataJson: text('metadata_json'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdByActorType: varchar('created_by_actor_type', { length: 32 }).notNull().default('SYSTEM'),
    createdByActorId: varchar('created_by_actor_id', { length: 128 }).notNull().default('system'),
    updatedByActorType: varchar('updated_by_actor_type', { length: 32 }).notNull().default('SYSTEM'),
    updatedByActorId: varchar('updated_by_actor_id', { length: 128 }).notNull().default('system'),
  },
  (table) => [
    uniqueIndex('seller_profiles_slug_uniq').on(table.slug),
    index('seller_profiles_tenant_status_idx').on(table.tenantId, table.status),
    index('seller_profiles_store_idx').on(table.storeId),
  ]
);

export type SellerProfileRecord = typeof sellerProfilesTable.$inferSelect;
export type InsertSellerProfileRecord = typeof sellerProfilesTable.$inferInsert;
