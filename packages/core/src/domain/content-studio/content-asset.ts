import { type EntityId } from '../../common/id.js';
import { type TenantId } from '../tenant/tenant.js';
import { type ProductId } from '../catalog/product.js';
import { Result, ok, err } from '../../common/result.js';
import {
  ContentGroundingValidator,
  type GroundingAttributes,
} from './content-grounding.validator.js';
import { ContentGroundingViolationError } from './content-studio-errors.js';

export type ContentAssetId = EntityId<'ContentAsset'>;

export const CONTENT_TYPES = [
  'PRODUCT_DESCRIPTION',
  'SOCIAL_CAPTION',
  'CERTIFICATE_OF_AUTHENTICITY',
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_LANGUAGES = ['fa-IR', 'en-US', 'ar-AE'] as const;
export type ContentLanguage = (typeof CONTENT_LANGUAGES)[number];

export interface ContentAssetProps {
  tenantId: TenantId;
  productId?: ProductId | undefined;
  contentType: ContentType;
  language: ContentLanguage;
  headline: string;
  body: string;
  tags?: string[] | undefined;
  groundingAttributes: GroundingAttributes;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateContentAssetInput {
  tenantId: TenantId;
  productId?: ProductId | undefined;
  contentType: ContentType;
  language: ContentLanguage;
  headline: string;
  body: string;
  tags?: string[] | undefined;
  groundingAttributes: GroundingAttributes;
}

export class ContentAsset {
  private readonly _id: ContentAssetId;
  private _props: ContentAssetProps;

  constructor(id: ContentAssetId, props: ContentAssetProps) {
    this._id = id;
    this._props = props;
  }

  static create(
    id: ContentAssetId,
    input: CreateContentAssetInput
  ): Result<ContentAsset, ContentGroundingViolationError> {
    // Grounding verification across headline and body
    const fullText = `${input.headline}\n${input.body}`;
    const validation = ContentGroundingValidator.validate(fullText, input.groundingAttributes);
    if (validation.isErr) {
      return err(validation.error);
    }

    const now = new Date();
    return ok(
      new ContentAsset(id, {
        tenantId: input.tenantId,
        productId: input.productId,
        contentType: input.contentType,
        language: input.language,
        headline: input.headline,
        body: input.body,
        tags: input.tags,
        groundingAttributes: input.groundingAttributes,
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  get id(): ContentAssetId {
    return this._id;
  }

  get tenantId(): TenantId {
    return this._props.tenantId;
  }

  get productId(): ProductId | undefined {
    return this._props.productId;
  }

  get contentType(): ContentType {
    return this._props.contentType;
  }

  get language(): ContentLanguage {
    return this._props.language;
  }

  get headline(): string {
    return this._props.headline;
  }

  get body(): string {
    return this._props.body;
  }

  get tags(): readonly string[] | undefined {
    return this._props.tags;
  }

  get groundingAttributes(): GroundingAttributes {
    return this._props.groundingAttributes;
  }

  get createdAt(): Date {
    return this._props.createdAt;
  }

  get updatedAt(): Date {
    return this._props.updatedAt;
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      productId: this.productId,
      contentType: this.contentType,
      language: this.language,
      headline: this.headline,
      body: this.body,
      tags: this.tags,
      groundingAttributes: this.groundingAttributes,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
