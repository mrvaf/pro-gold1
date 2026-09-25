import type { TenantId } from '../tenant/tenant.js';
import {
  InvalidPublishingChannelError,
  InvalidPostStateTransitionError,
  PublishingPostValidationError,
} from './social-commerce-errors.js';

export const PUBLISHING_PLATFORMS = ['INSTAGRAM', 'TELEGRAM', 'WHATSAPP'] as const;
export type PublishingPlatform = (typeof PUBLISHING_PLATFORMS)[number];

export const POST_STATUSES = ['DRAFT', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED'] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export interface ChannelCredentials {
  readonly encryptedAccessToken: string;
  readonly accountId?: string | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface PublishingChannelProps {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly platform: PublishingPlatform;
  readonly channelName: string;
  readonly encryptedAccessToken: string;
  readonly accountId?: string | undefined;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class PublishingChannel {
  private constructor(private readonly props: PublishingChannelProps) {}

  public static create(params: {
    id: string;
    tenantId: TenantId;
    platform: PublishingPlatform;
    channelName: string;
    encryptedAccessToken: string;
    accountId?: string | undefined;
    isActive?: boolean | undefined;
    createdAt?: Date | undefined;
    updatedAt?: Date | undefined;
  }): PublishingChannel {
    if (!params.id || params.id.trim().length === 0) {
      throw new InvalidPublishingChannelError('Channel ID cannot be empty');
    }
    if (!params.tenantId || params.tenantId.trim().length === 0) {
      throw new InvalidPublishingChannelError('Tenant ID cannot be empty');
    }
    if (!PUBLISHING_PLATFORMS.includes(params.platform)) {
      throw new InvalidPublishingChannelError(`Unsupported platform: ${params.platform}`);
    }
    if (!params.channelName || params.channelName.trim().length === 0) {
      throw new InvalidPublishingChannelError('Channel name cannot be empty');
    }
    if (!params.encryptedAccessToken || params.encryptedAccessToken.trim().length === 0) {
      throw new InvalidPublishingChannelError('Encrypted access token cannot be empty');
    }

    const now = new Date();
    return new PublishingChannel({
      id: params.id,
      tenantId: params.tenantId,
      platform: params.platform,
      channelName: params.channelName.trim(),
      encryptedAccessToken: params.encryptedAccessToken,
      accountId: params.accountId,
      isActive: params.isActive ?? true,
      createdAt: params.createdAt ?? now,
      updatedAt: params.updatedAt ?? now,
    });
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): TenantId {
    return this.props.tenantId;
  }
  get platform(): PublishingPlatform {
    return this.props.platform;
  }
  get channelName(): string {
    return this.props.channelName;
  }
  get encryptedAccessToken(): string {
    return this.props.encryptedAccessToken;
  }
  get accountId(): string | undefined {
    return this.props.accountId;
  }
  get isActive(): boolean {
    return this.props.isActive;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  toJSON(): PublishingChannelProps {
    return { ...this.props };
  }
}

export interface PublishingPostProps {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly channelId: string;
  readonly contentAssetId?: string | undefined;
  readonly caption: string;
  readonly mediaUrls: string[];
  readonly status: PostStatus;
  readonly scheduledAt: Date;
  readonly publishedAt?: Date | undefined;
  readonly externalPostId?: string | undefined;
  readonly failureReason?: string | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class PublishingPost {
  private constructor(private props: PublishingPostProps) {}

  public static create(params: {
    id: string;
    tenantId: TenantId;
    channelId: string;
    contentAssetId?: string | undefined;
    caption: string;
    mediaUrls?: string[] | undefined;
    status?: PostStatus | undefined;
    scheduledAt: Date;
    publishedAt?: Date | undefined;
    externalPostId?: string | undefined;
    failureReason?: string | undefined;
    createdAt?: Date | undefined;
    updatedAt?: Date | undefined;
  }): PublishingPost {
    if (!params.id || params.id.trim().length === 0) {
      throw new PublishingPostValidationError('Post ID cannot be empty');
    }
    if (!params.tenantId || params.tenantId.trim().length === 0) {
      throw new PublishingPostValidationError('Tenant ID cannot be empty');
    }
    if (!params.channelId || params.channelId.trim().length === 0) {
      throw new PublishingPostValidationError('Channel ID cannot be empty');
    }
    if (!params.caption || params.caption.trim().length === 0) {
      throw new PublishingPostValidationError('Post caption cannot be empty');
    }
    if (!params.scheduledAt || isNaN(params.scheduledAt.getTime())) {
      throw new PublishingPostValidationError('Valid scheduled date must be provided');
    }

    const now = new Date();
    return new PublishingPost({
      id: params.id,
      tenantId: params.tenantId,
      channelId: params.channelId,
      contentAssetId: params.contentAssetId,
      caption: params.caption.trim(),
      mediaUrls: params.mediaUrls ?? [],
      status: params.status ?? 'SCHEDULED',
      scheduledAt: params.scheduledAt,
      publishedAt: params.publishedAt,
      externalPostId: params.externalPostId,
      failureReason: params.failureReason,
      createdAt: params.createdAt ?? now,
      updatedAt: params.updatedAt ?? now,
    });
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): TenantId {
    return this.props.tenantId;
  }
  get channelId(): string {
    return this.props.channelId;
  }
  get contentAssetId(): string | undefined {
    return this.props.contentAssetId;
  }
  get caption(): string {
    return this.props.caption;
  }
  get mediaUrls(): string[] {
    return [...this.props.mediaUrls];
  }
  get status(): PostStatus {
    return this.props.status;
  }
  get scheduledAt(): Date {
    return this.props.scheduledAt;
  }
  get publishedAt(): Date | undefined {
    return this.props.publishedAt;
  }
  get externalPostId(): string | undefined {
    return this.props.externalPostId;
  }
  get failureReason(): string | undefined {
    return this.props.failureReason;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  markPublishing(): void {
    if (this.props.status !== 'SCHEDULED' && this.props.status !== 'FAILED') {
      throw new InvalidPostStateTransitionError(this.props.status, 'PUBLISHING');
    }
    this.props = {
      ...this.props,
      status: 'PUBLISHING',
      updatedAt: new Date(),
    };
  }

  markPublished(externalPostId: string): void {
    if (this.props.status !== 'PUBLISHING') {
      throw new InvalidPostStateTransitionError(this.props.status, 'PUBLISHED');
    }
    const now = new Date();
    this.props = {
      ...this.props,
      status: 'PUBLISHED',
      publishedAt: now,
      externalPostId,
      failureReason: undefined,
      updatedAt: now,
    };
  }

  markFailed(reason: string): void {
    if (this.props.status !== 'PUBLISHING') {
      throw new InvalidPostStateTransitionError(this.props.status, 'FAILED');
    }
    this.props = {
      ...this.props,
      status: 'FAILED',
      failureReason: reason,
      updatedAt: new Date(),
    };
  }

  toJSON(): PublishingPostProps {
    return { ...this.props };
  }
}
