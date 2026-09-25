import type { TenantId } from '../domain/tenant/tenant.js';
import type { PublishingChannel, PublishingPost, PublishingPlatform } from '../domain/social-commerce/publishing-post.js';

export interface PublishResult {
  readonly success: boolean;
  readonly externalPostId?: string;
  readonly error?: string;
}

export interface SocialPublishingPort {
  publishPost(params: {
    platform: PublishingPlatform;
    plainAccessToken: string;
    caption: string;
    mediaUrls: string[];
    accountId?: string;
  }): Promise<PublishResult>;
}

export interface SocialCommerceRepositoryPort {
  saveChannel(channel: PublishingChannel): Promise<void>;
  findChannelById(id: string, tenantId: TenantId): Promise<PublishingChannel | null>;
  findChannelsByTenant(tenantId: TenantId): Promise<PublishingChannel[]>;

  savePost(post: PublishingPost): Promise<void>;
  findPostById(id: string, tenantId: TenantId): Promise<PublishingPost | null>;
  findPostsByTenant(tenantId: TenantId, limit?: number): Promise<PublishingPost[]>;
  findDueScheduledPosts(tenantId: TenantId, beforeDate: Date): Promise<PublishingPost[]>;
}
