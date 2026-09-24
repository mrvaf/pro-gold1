import { ValueObject } from '../../common/value-object.js';
import { ValidationError } from '../../common/errors.js';
import { ok, err, type Result } from '../../common/result.js';
import { SellerSlug } from './seller-slug.js';

export interface MarketplacePresenceProps {
  displayName: string;
  slug: SellerSlug;
  bio?: string | undefined;
  logoUrl?: string | undefined;
  bannerUrl?: string | undefined;
  isPubliclyVisible: boolean;
}

export interface CreateMarketplacePresenceProps {
  displayName: string;
  slug: SellerSlug | string;
  bio?: string | undefined;
  logoUrl?: string | undefined;
  bannerUrl?: string | undefined;
  isPubliclyVisible?: boolean | undefined;
}

/**
 * Value Object representing the public storefront identity of a seller in the marketplace.
 */
export class SellerMarketplacePresence extends ValueObject<MarketplacePresenceProps> {
  private constructor(props: MarketplacePresenceProps) {
    super(props);
  }

  get displayName(): string {
    return this.props.displayName;
  }

  get slug(): SellerSlug {
    return this.props.slug;
  }

  get bio(): string | undefined {
    return this.props.bio;
  }

  get logoUrl(): string | undefined {
    return this.props.logoUrl;
  }

  get bannerUrl(): string | undefined {
    return this.props.bannerUrl;
  }

  get isPubliclyVisible(): boolean {
    return this.props.isPubliclyVisible;
  }

  static create(props: CreateMarketplacePresenceProps): Result<SellerMarketplacePresence, ValidationError> {
    if (!props.displayName || props.displayName.trim().length < 2) {
      return err(new ValidationError('Seller display name must have at least 2 characters.'));
    }
    if (props.displayName.trim().length > 255) {
      return err(new ValidationError('Seller display name cannot exceed 255 characters.'));
    }

    let slugObj: SellerSlug;
    if (props.slug instanceof SellerSlug) {
      slugObj = props.slug;
    } else {
      const slugRes = SellerSlug.create(props.slug);
      if (slugRes.isErr) return err(slugRes.error);
      slugObj = slugRes.value;
    }

    const trimmedBio = props.bio?.trim();
    if (trimmedBio && trimmedBio.length > 2000) {
      return err(new ValidationError('Seller bio cannot exceed 2000 characters.'));
    }

    return ok(
      new SellerMarketplacePresence({
        displayName: props.displayName.trim(),
        slug: slugObj,
        bio: trimmedBio || undefined,
        logoUrl: props.logoUrl?.trim() || undefined,
        bannerUrl: props.bannerUrl?.trim() || undefined,
        isPubliclyVisible: props.isPubliclyVisible ?? true,
      })
    );
  }

  withUpdatedDisplay(
    displayName: string,
    bio?: string | undefined,
    logoUrl?: string | undefined,
    bannerUrl?: string | undefined,
    isPubliclyVisible?: boolean | undefined
  ): Result<SellerMarketplacePresence, ValidationError> {
    return SellerMarketplacePresence.create({
      displayName,
      slug: this.props.slug,
      bio: bio !== undefined ? bio : this.props.bio,
      logoUrl: logoUrl !== undefined ? logoUrl : this.props.logoUrl,
      bannerUrl: bannerUrl !== undefined ? bannerUrl : this.props.bannerUrl,
      isPubliclyVisible: isPubliclyVisible !== undefined ? isPubliclyVisible : this.props.isPubliclyVisible,
    });
  }
}
