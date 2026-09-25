import type {
  SocialCommerceRepositoryPort,
  PublishingChannel,
  PublishingPost,
  TenantId,
} from '@v-gold/core';

export class InMemorySocialCommerceRepository implements SocialCommerceRepositoryPort {
  private channels = new Map<string, PublishingChannel>();
  private posts = new Map<string, PublishingPost>();

  async saveChannel(channel: PublishingChannel): Promise<void> {
    this.channels.set(channel.id, channel);
  }

  async findChannelById(id: string, tenantId: TenantId): Promise<PublishingChannel | null> {
    const channel = this.channels.get(id);
    if (!channel || channel.tenantId !== tenantId) {
      return null;
    }
    return channel;
  }

  async findChannelsByTenant(tenantId: TenantId): Promise<PublishingChannel[]> {
    return Array.from(this.channels.values()).filter((c) => c.tenantId === tenantId);
  }

  async savePost(post: PublishingPost): Promise<void> {
    this.posts.set(post.id, post);
  }

  async findPostById(id: string, tenantId: TenantId): Promise<PublishingPost | null> {
    const post = this.posts.get(id);
    if (!post || post.tenantId !== tenantId) {
      return null;
    }
    return post;
  }

  async findPostsByTenant(tenantId: TenantId, limit?: number): Promise<PublishingPost[]> {
    const results = Array.from(this.posts.values())
      .filter((p) => p.tenantId === tenantId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return limit ? results.slice(0, limit) : results;
  }

  async findDueScheduledPosts(tenantId: TenantId, beforeDate: Date): Promise<PublishingPost[]> {
    return Array.from(this.posts.values()).filter(
      (p) =>
        p.tenantId === tenantId &&
        (p.status === 'SCHEDULED' || p.status === 'FAILED') &&
        p.scheduledAt.getTime() <= beforeDate.getTime()
    );
  }

  clear(): void {
    this.channels.clear();
    this.posts.clear();
  }
}
