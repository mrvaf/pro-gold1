import { ValueObject } from '../../common/value-object.js';
import { ValidationError } from '../../common/errors.js';
import { ok, err, type Result } from '../../common/result.js';

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MIN_LENGTH = 3;
const MAX_LENGTH = 64;

const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'auth',
  'cart',
  'checkout',
  'dashboard',
  'login',
  'logout',
  'marketplace',
  'null',
  'order',
  'orders',
  'pricing',
  'product',
  'products',
  'register',
  'seller',
  'sellers',
  'shop',
  'system',
  'undefined',
  'vault',
  'vgold',
]);

interface SellerSlugProps {
  value: string;
}

/**
 * Value Object representing a validated, normalized, URL-safe Seller Marketplace Slug.
 */
export class SellerSlug extends ValueObject<SellerSlugProps> {
  private constructor(props: SellerSlugProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  static create(rawSlug: string): Result<SellerSlug, ValidationError> {
    if (!rawSlug || typeof rawSlug !== 'string') {
      return err(new ValidationError('Seller slug must be a non-empty string.'));
    }

    const normalized = rawSlug.trim().toLowerCase();

    if (normalized.length < MIN_LENGTH || normalized.length > MAX_LENGTH) {
      return err(
        new ValidationError(
          `Seller slug length must be between ${MIN_LENGTH} and ${MAX_LENGTH} characters. Received ${normalized.length}.`
        )
      );
    }

    if (!SLUG_REGEX.test(normalized)) {
      return err(
        new ValidationError(
          `Invalid seller slug format "${rawSlug}". Slug must contain only lowercase alphanumeric characters and single hyphens, with no consecutive hyphens or leading/trailing hyphens.`
        )
      );
    }

    if (RESERVED_SLUGS.has(normalized)) {
      return err(new ValidationError(`The slug "${normalized}" is reserved by the platform.`));
    }

    return ok(new SellerSlug({ value: normalized }));
  }

  /**
   * Helper to normalize an arbitrary string into a candidate slug.
   */
  static fromString(input: string): Result<SellerSlug, ValidationError> {
    const candidate = input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return SellerSlug.create(candidate);
  }

  override toString(): string {
    return this.props.value;
  }
}
