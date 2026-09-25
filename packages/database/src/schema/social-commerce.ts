import { pgTable, varchar, timestamp, text, jsonb, boolean } from 'drizzle-orm/pg-core';
import { tenantsTable } from './tenants.js';
import { contentAssetsTable } from './content-assets.js';

export const publishingChannelsTable = pgTable('publishing_channels', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 })
    .notNull()
    .references(() => tenantsTable.id, { onDelete: 'cascade' }),
  platform: varchar('platform', { length: 32 }).notNull(),
  channelName: varchar('channel_name', { length: 255 }).notNull(),
  encryptedAccessToken: text('encrypted_access_token').notNull(),
  accountId: varchar('account_id', { length: 128 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const publishingPostsTable = pgTable('publishing_posts', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 })
    .notNull()
    .references(() => tenantsTable.id, { onDelete: 'cascade' }),
  channelId: varchar('channel_id', { length: 64 })
    .notNull()
    .references(() => publishingChannelsTable.id, { onDelete: 'cascade' }),
  contentAssetId: varchar('content_asset_id', { length: 64 })
    .references(() => contentAssetsTable.id, { onDelete: 'set null' }),
  caption: text('caption').notNull(),
  mediaUrls: jsonb('media_urls').notNull().$type<string[]>(),
  status: varchar('status', { length: 32 }).notNull().default('SCHEDULED'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  externalPostId: varchar('external_post_id', { length: 255 }),
  failureReason: text('failure_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
