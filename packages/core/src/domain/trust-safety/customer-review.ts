import type { TenantId } from '../tenant/tenant.js';
import { InvalidReviewModerationError } from './trust-safety-errors.js';

export const MODERATION_STATUSES = ['PENDING_REVIEW', 'APPROVED', 'REJECTED'] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export interface CustomerReviewProps {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly orderId: string;
  readonly customerId: string;
  readonly sellerProfileId: string;
  readonly rating: number; // 1 to 5 stars
  readonly title: string;
  readonly comment: string;
  readonly isVerifiedPurchase: boolean;
  readonly moderationStatus: ModerationStatus;
  readonly moderationNotes?: string | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class CustomerReview {
  private constructor(private props: CustomerReviewProps) {}

  public static create(params: {
    id: string;
    tenantId: TenantId;
    orderId: string;
    customerId: string;
    sellerProfileId: string;
    rating: number;
    title: string;
    comment: string;
    isVerifiedPurchase?: boolean | undefined;
    moderationStatus?: ModerationStatus | undefined;
    moderationNotes?: string | undefined;
    createdAt?: Date | undefined;
    updatedAt?: Date | undefined;
  }): CustomerReview {
    if (!params.id || params.id.trim().length === 0) {
      throw new InvalidReviewModerationError('Review ID cannot be empty');
    }
    if (!params.tenantId || params.tenantId.trim().length === 0) {
      throw new InvalidReviewModerationError('Tenant ID cannot be empty');
    }
    if (!params.orderId || params.orderId.trim().length === 0) {
      throw new InvalidReviewModerationError('Order ID cannot be empty (reviews require verified orders)');
    }
    if (!params.sellerProfileId || params.sellerProfileId.trim().length === 0) {
      throw new InvalidReviewModerationError('Seller profile ID cannot be empty');
    }
    if (!Number.isInteger(params.rating) || params.rating < 1 || params.rating > 5) {
      throw new InvalidReviewModerationError('Rating must be an integer between 1 and 5');
    }
    if (!params.title || params.title.trim().length === 0) {
      throw new InvalidReviewModerationError('Review title cannot be empty');
    }
    if (!params.comment || params.comment.trim().length === 0) {
      throw new InvalidReviewModerationError('Review comment cannot be empty');
    }

    const now = new Date();
    return new CustomerReview({
      id: params.id,
      tenantId: params.tenantId,
      orderId: params.orderId,
      customerId: params.customerId,
      sellerProfileId: params.sellerProfileId,
      rating: params.rating,
      title: params.title.trim(),
      comment: params.comment.trim(),
      isVerifiedPurchase: params.isVerifiedPurchase ?? true,
      moderationStatus: params.moderationStatus ?? 'PENDING_REVIEW',
      moderationNotes: params.moderationNotes,
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
  get orderId(): string {
    return this.props.orderId;
  }
  get customerId(): string {
    return this.props.customerId;
  }
  get sellerProfileId(): string {
    return this.props.sellerProfileId;
  }
  get rating(): number {
    return this.props.rating;
  }
  get title(): string {
    return this.props.title;
  }
  get comment(): string {
    return this.props.comment;
  }
  get isVerifiedPurchase(): boolean {
    return this.props.isVerifiedPurchase;
  }
  get moderationStatus(): ModerationStatus {
    return this.props.moderationStatus;
  }
  get moderationNotes(): string | undefined {
    return this.props.moderationNotes;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  approve(moderatorNotes?: string): void {
    const now = new Date();
    this.props = {
      ...this.props,
      moderationStatus: 'APPROVED',
      moderationNotes: moderatorNotes,
      updatedAt: now,
    };
  }

  reject(moderatorNotes: string): void {
    if (!moderatorNotes || moderatorNotes.trim().length === 0) {
      throw new InvalidReviewModerationError('Moderation notes are mandatory for rejection');
    }
    const now = new Date();
    this.props = {
      ...this.props,
      moderationStatus: 'REJECTED',
      moderationNotes: moderatorNotes.trim(),
      updatedAt: now,
    };
  }

  toJSON(): CustomerReviewProps {
    return { ...this.props };
  }
}
