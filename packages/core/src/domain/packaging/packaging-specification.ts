import { Result, ok, err } from '../../common/result.js';
import { Money } from '../finance/money.js';
import { type EntityId } from '../../common/id.js';
import { BoxDimensions, type BoxDimensionsProps } from './box-dimensions.js';
import { BoxMaterial, LuxuryTier, PackagingCostCalculator } from './packaging-cost-model.js';
import { InvalidPackagingDimensionsError, InvalidPackagingMaterialError } from './packaging-errors.js';
import { type TenantId } from '../tenant/tenant.js';
import { type ProductId } from '../catalog/product.js';

export type PackagingSpecId = EntityId<'PackagingSpecification'>;

export interface DielineSpecification {
  fluteOrBoardThicknessMm: number;
  creasingMatrixMm: number;
  insertCushionType: 'FOAM_SLOT' | 'VELVET_PILLOW' | 'RING_CLIP' | 'PENDANT_GROOVE';
}

export interface PackagingSpecificationProps {
  tenantId: TenantId;
  productId?: ProductId | undefined;
  name: string;
  dimensions: BoxDimensions;
  material: BoxMaterial;
  tier: LuxuryTier;
  primaryColorHex: string;
  accentColorHex?: string | undefined;
  hasCustomDieline: boolean;
  hasFoilEmbossing: boolean;
  dieline?: DielineSpecification | undefined;
  productionCost: Money;
  aiPreviewImageUrl?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePackagingSpecInput {
  tenantId: TenantId;
  productId?: ProductId | undefined;
  name: string;
  dimensions: BoxDimensionsProps;
  material: BoxMaterial;
  tier: LuxuryTier;
  primaryColorHex: string;
  accentColorHex?: string | undefined;
  hasCustomDieline?: boolean | undefined;
  hasFoilEmbossing?: boolean | undefined;
  dieline?: DielineSpecification | undefined;
  currency?: 'USD' | 'EUR' | 'IRR' | 'TOMAN' | undefined;
}

export class PackagingSpecification {
  private readonly _id: PackagingSpecId;
  private _props: PackagingSpecificationProps;

  constructor(id: PackagingSpecId, props: PackagingSpecificationProps) {
    this._id = id;
    this._props = props;
  }

  static create(
    id: PackagingSpecId,
    input: CreatePackagingSpecInput
  ): Result<PackagingSpecification, InvalidPackagingDimensionsError | InvalidPackagingMaterialError> {
    const dimResult = BoxDimensions.create(input.dimensions);
    if (dimResult.isErr) {
      return err(dimResult.error);
    }
    const dimensions = dimResult.value;

    const hasCustomDieline = input.hasCustomDieline ?? false;
    const hasFoilEmbossing = input.hasFoilEmbossing ?? false;

    const costResult = PackagingCostCalculator.calculateCost(
      dimensions,
      {
        material: input.material,
        tier: input.tier,
        hasCustomDieline,
        hasFoilEmbossing,
      },
      input.currency ?? 'USD'
    );

    if (costResult.isErr) {
      return err(costResult.error);
    }

    const now = new Date();
    return ok(
      new PackagingSpecification(id, {
        tenantId: input.tenantId,
        productId: input.productId,
        name: input.name,
        dimensions,
        material: input.material,
        tier: input.tier,
        primaryColorHex: input.primaryColorHex,
        accentColorHex: input.accentColorHex,
        hasCustomDieline,
        hasFoilEmbossing,
        dieline: input.dieline,
        productionCost: costResult.value,
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  get id(): PackagingSpecId {
    return this._id;
  }

  get tenantId(): TenantId {
    return this._props.tenantId;
  }

  get productId(): ProductId | undefined {
    return this._props.productId;
  }

  get name(): string {
    return this._props.name;
  }

  get dimensions(): BoxDimensions {
    return this._props.dimensions;
  }

  get material(): BoxMaterial {
    return this._props.material;
  }

  get tier(): LuxuryTier {
    return this._props.tier;
  }

  get primaryColorHex(): string {
    return this._props.primaryColorHex;
  }

  get accentColorHex(): string | undefined {
    return this._props.accentColorHex;
  }

  get hasCustomDieline(): boolean {
    return this._props.hasCustomDieline;
  }

  get hasFoilEmbossing(): boolean {
    return this._props.hasFoilEmbossing;
  }

  get dieline(): DielineSpecification | undefined {
    return this._props.dieline;
  }

  get productionCost(): Money {
    return this._props.productionCost;
  }

  get aiPreviewImageUrl(): string | undefined {
    return this._props.aiPreviewImageUrl;
  }

  get createdAt(): Date {
    return this._props.createdAt;
  }

  get updatedAt(): Date {
    return this._props.updatedAt;
  }

  setAiPreviewImageUrl(url: string) {
    this._props.aiPreviewImageUrl = url;
    this._props.updatedAt = new Date();
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      productId: this.productId,
      name: this.name,
      dimensions: this.dimensions.toJSON(),
      material: this.material,
      tier: this.tier,
      primaryColorHex: this.primaryColorHex,
      accentColorHex: this.accentColorHex,
      hasCustomDieline: this.hasCustomDieline,
      hasFoilEmbossing: this.hasFoilEmbossing,
      dieline: this.dieline,
      productionCost: {
        amount: this.productionCost.amount.toString(),
        currency: this.productionCost.currency,
      },
      aiPreviewImageUrl: this.aiPreviewImageUrl,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
