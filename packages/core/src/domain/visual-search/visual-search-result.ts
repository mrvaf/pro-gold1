import { ValueObject } from '../../common/value-object.js';
import type { ProductId } from '../catalog/product.js';
import type { ProductVariantId } from '../catalog/product-variant.js';
import type { JewelryType } from '../catalog/jewelry-specification.js';
import type { MaterialType } from '../catalog/material-specification.js';

export interface VisualSearchResultItemProps {
  productId: ProductId;
  variantId?: ProductVariantId | undefined;
  productName: string;
  similarityScore: number; // 0.0 to 1.0
  rank: number;
  matchedAttributes?: {
    jewelryType?: JewelryType | undefined;
    metalType?: MaterialType | undefined;
    category?: string | undefined;
  } | undefined;
}

export class VisualSearchResultItem extends ValueObject<VisualSearchResultItemProps> {
  private constructor(props: VisualSearchResultItemProps) {
    super(props);
  }

  get productId(): ProductId {
    return this.props.productId;
  }

  get variantId(): ProductVariantId | undefined {
    return this.props.variantId;
  }

  get productName(): string {
    return this.props.productName;
  }

  get similarityScore(): number {
    return this.props.similarityScore;
  }

  get rank(): number {
    return this.props.rank;
  }

  get matchedAttributes(): VisualSearchResultItemProps['matchedAttributes'] {
    return this.props.matchedAttributes;
  }

  static create(props: VisualSearchResultItemProps): VisualSearchResultItem {
    return new VisualSearchResultItem(props);
  }

  toDto(): VisualSearchResultItemProps {
    return { ...this.props };
  }
}
