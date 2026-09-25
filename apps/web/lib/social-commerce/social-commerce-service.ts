import {
  type SocialCommerceRepositoryPort,
  type SocialPublishingPort,
  PublishingChannel,
  PublishingPost,
  SecureCredentialVault,
  PublishingChannelNotFoundError,
  PublishingPostNotFoundError,
  type TenantId,
  type PublishingPlatform,
  type PostStatus,
} from '@v-gold/core';

export interface ConnectChannelDto {
  tenantId: string;
  platform: PublishingPlatform;
  channelName: string;
  accessToken: string; // Plain token provided by caller; will be encrypted before storage
  accountId?: string;
}

export interface SchedulePostDto {
  tenantId: string;
  channelId: string;
  contentAssetId?: string;
  caption: string;
  mediaUrls?: string[];
  scheduledAt: Date;
}

export class SocialCommerceService {
  private readonly vault: SecureCredentialVault;

  constructor(
    private readonly repo: SocialCommerceRepositoryPort,
    private readonly publisher: SocialPublishingPort,
    vaultMasterKeyHex?: string
  ) {
    this.vault = new SecureCredentialVault(vaultMasterKeyHex);
  }

  async connectChannel(dto: ConnectChannelDto): Promise<PublishingChannel> {
    const channelId = `pub_chn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const encryptedToken = this.vault.encrypt(dto.accessToken);

    const channel = PublishingChannel.create({
      id: channelId,
      tenantId: dto.tenantId as TenantId,
      platform: dto.platform,
      channelName: dto.channelName,
      encryptedAccessToken: encryptedToken,
      accountId: dto.accountId,
      isActive: true,
    });

    await this.repo.saveChannel(channel);
    return channel;
  }

  async listChannels(tenantId: string): Promise<PublishingChannel[]> {
    return this.repo.findChannelsByTenant(tenantId as TenantId);
  }

  async schedulePost(dto: SchedulePostDto): Promise<PublishingPost> {
    const channel = await this.repo.findChannelById(dto.channelId, dto.tenantId as TenantId);
    if (!channel) {
      throw new PublishingChannelNotFoundError(dto.channelId);
    }

    const postId = `pub_post_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const post = PublishingPost.create({
      id: postId,
      tenantId: dto.tenantId as TenantId,
      channelId: dto.channelId,
      contentAssetId: dto.contentAssetId,
      caption: dto.caption,
      mediaUrls: dto.mediaUrls,
      status: 'SCHEDULED',
      scheduledAt: dto.scheduledAt,
    });

    await this.repo.savePost(post);
    return post;
  }

  async listPosts(tenantId: string, limit?: number): Promise<PublishingPost[]> {
    return this.repo.findPostsByTenant(tenantId as TenantId, limit);
  }

  async getPostById(postId: string, tenantId: string): Promise<PublishingPost> {
    const post = await this.repo.findPostById(postId, tenantId as TenantId);
    if (!post) {
      throw new PublishingPostNotFoundError(postId);
    }
    return post;
  }

  async publishDuePost(postId: string, tenantId: string): Promise<PublishingPost> {
    const post = await this.getPostById(postId, tenantId);
    const channel = await this.repo.findChannelById(post.channelId, tenantId as TenantId);
    if (!channel) {
      throw new PublishingChannelNotFoundError(post.channelId);
    }

    post.markPublishing();
    await this.repo.savePost(post);

    const plainAccessToken = this.vault.decrypt(channel.encryptedAccessToken);
    const result = await this.publisher.publishPost({
      platform: channel.platform,
      plainAccessToken,
      caption: post.caption,
      mediaUrls: post.mediaUrls,
      accountId: channel.accountId,
    });

    if (result.success && result.externalPostId) {
      post.markPublished(result.externalPostId);
    } else {
      post.markFailed(result.error ?? 'Unknown publishing failure');
    }

    await this.repo.savePost(post);
    return post;
  }
}
