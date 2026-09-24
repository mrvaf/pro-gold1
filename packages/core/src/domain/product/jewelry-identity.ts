import { ValueObject } from '../../common/value-object.js';
import { createEntityId, type EntityId } from '../../common/id.js';
import { ValidationError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';

export type JewelryId = EntityId<'Jewelry'>;

export interface JewelryIdentityProps {
  id: string;
  sku?: string;
  barcode?: string;
}

/**
 * Foundational Jewelry Identity Reference.
 * Provides the core identifier for catalog items without prematurely implementing
 * full product attributes or storefront models.
 */
export class JewelryIdentity extends ValueObject<JewelryIdentityProps> {
  private readonly _id: JewelryId;

  private constructor(id: JewelryId, sku?: string, barcode?: string) {
    super({
      id,
      ...(sku ? { sku } : {}),
      ...(barcode ? { barcode } : {}),
    });
    this._id = id;
  }

  get id(): JewelryId {
    return this._id;
  }

  get sku(): string | undefined {
    return this.props.sku;
  }

  get barcode(): string | undefined {
    return this.props.barcode;
  }

  static create(rawId: string, sku?: string, barcode?: string): Result<JewelryIdentity, ValidationError> {
    if (!rawId || rawId.trim().length === 0) {
      return err(new ValidationError('Jewelry ID cannot be empty.'));
    }
    const id = createEntityId<JewelryId>(rawId);
    return ok(new JewelryIdentity(id, sku?.trim(), barcode?.trim()));
  }
}
