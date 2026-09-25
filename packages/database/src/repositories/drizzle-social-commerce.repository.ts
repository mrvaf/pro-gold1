import {
  type SocialCommerceRepositoryPort,
  PublishingChannel,
  PublishingPost,
  type TenantId,
  type PublishingPlatform,
  type PostStatus,
} from '@v-gold/core';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { eq, and, lte, desc } from 'drizzle-orm';
import { publishingChannelsTable, publishingPostsTable } from '../schema/social-commerce.js';

export class DrizzleSocialCommerceRepository implements SocialCommerceRepositoryPort {
  constructor(private readonly db: PgDatabase<any, any, any>) {}

  async saveChannel(channel: PublishingChannel): Promise<void> {
    const raw = channel.toJSON();
    await this.db
      .insert(publishingChannelsTable)
      .values({
        id: raw.id,
        tenantId: raw.tenantId,
        platform: raw.platform,
        channelName: raw.channelName,
        encryptedAccessToken: raw.encryptedAccessToken,
        accountId: raw.accountId ?? null,
        isActive: raw.isActive,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
      })
      .onConflictDoUpdate({
        target: publishingChannelsTable.id,
        set: {
          platform: raw.platform,
          channelName: raw.channelName,
          encryptedAccessToken: raw.encryptedAccessToken,
          accountId: raw.accountId ?? null,
          isActive: raw.isActive,
          updatedAt: raw.updatedAt,
        },
      });
  }

  async findChannelById(id: string, tenantId: TenantId): Promise<PublishingChannel | null> {
    const rows = await this.db
      .select()
      .from(publishingChannelsTable)
      .where(and(eq(publishingChannelsTable.id, id), eq(publishingChannelsTable.tenantId, tenantId)))
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapChannelToDomain(rows[0]!);
  }

  async findChannelsByTenant(tenantId: TenantId): Promise<PublishingChannel[]> {
    const rows = await this.db
      .select()
      .from(publishingChannelsTable)
      .where(eq(publishingChannelsTable.tenantId, tenantId));

    return rows.map((r: any) => this.mapChannelToDomain(r));
  }

  async savePost(post: PublishingPost): Promise<void> {
    const raw = post.toJSON();
    await this.db
      .insert(publishingPostsTable)
      .values({
        id: raw.id,
        tenantId: raw.tenantId,
        channelId: raw.channelId,
        contentAssetId: raw.contentAssetId ?? null,
        caption: raw.caption,
        mediaUrls: raw.mediaUrls,
        status: raw.status,
        scheduledAt: raw.scheduledAt,
        publishedAt: raw.publishedAt ?? null,
        externalPostId: raw.externalPostId ?? null,
        failureReason: raw.failureReason ?? null,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
      })
      .onConflictDoUpdate({
        target: publishingPostsTable.id,
        set: {
          channelId: raw.channelId,
          contentAssetId: raw.contentAssetId ?? null,
          caption: raw.caption,
          mediaUrls: raw.mediaUrls,
          status: raw.status,
          scheduledAt: raw.scheduledAt,
          publishedAt: raw.publishedAt ?? null,
          externalPostId: raw.externalPostId ?? null,
          failureReason: raw.failureReason ?? null,
          updatedAt: raw.updatedAt,
        },
      });
  }

  async findPostById(id: string, tenantId: TenantId): Promise<PublishingPost | null> {
    const rows = await this.db
      .select()
      .from(publishingPostsTable)
      .where(and(eq(publishingPostsTable.id, id), eq(publishingPostsTable.tenantId, tenantId)))
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapPostToDomain(rows[0]!);
  }

  async findPostsByTenant(tenantId: TenantId, limit?: number): Promise<PublishingPost[]> {
    let query = this.db
      .select()
      .from(publishingPostsTable)
      .where(eq(publishingPostsTable.tenantId, tenantId))
      .orderBy(desc(publishingPostsTable.createdAt));

    if (limit) {
      query = query.limit(limit) as any;
    }

    const rows = await query;
    return rows.map((r: any) => this.mapPostToDomain(r));
  }

  async findDueScheduledPosts(tenantId: TenantId, beforeDate: Date): Promise<PublishingPost[]> {
    const rows = await this.db
      .select()
      .from(publishingPostsTable)
      .where(
        and(
          eq(publishingPostsTable.tenantId, tenantId),
          lte(publishingPostsTable.scheduledAt, beforeDate)
        )
      );

    return rows
      .map((r: any) => this.mapPostToDomain(r))
      .filter((p: PublishingPost) => p.status === 'SCHEDULED' || p.status === 'FAILED');
  }

  private mapChannelToDomain(row: any): PublishingChannel {
    return PublishingChannel.create({
      id: row.id,
      tenantId: row.tenantId,
      platform: row.platform as PublishingPlatform,
      channelName: row.channelName,
      encryptedAccessToken: row.encryptedAccessToken,
      accountId: row.accountId ?? undefined,
      isActive: row.isActive,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    });
  }

  private mapPostToDomain(row: any): PublishingPost {
    return PublishingPost.create({
      id: row.id,
      tenantId: row.tenantId,
      channelId: row.channelId,
      contentAssetId: row.contentAssetId ?? undefined,
      caption: row.caption,
      mediaUrls: Array.isArray(row.mediaUrls) ? row.mediaUrls : [],
      status: row.status as PostStatus,
      scheduledAt: new Date(row.scheduledAt),
      publishedAt: row.publishedAt ? new Date(row.publishedAt) : undefined,
      externalPostId: row.externalPostId ?? undefined,
      failureReason: row.failureReason ?? undefined,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    });
  }
}
