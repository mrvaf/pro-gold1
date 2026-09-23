import {
  type ProductRepositoryPort,
  type ProductVariantRepositoryPort,
  type ProductListFilter,
  type ProductVariantListFilter,
  Product,
  ProductVariant,
  type ProductId,
  type ProductVariantId,
  type ProductStatus,
  type ProductVariantStatus,
  SKU,
  Weight,
  GoldPurity,
  MaterialSpecification,
  JewelrySpecification,
  GemstoneSpecification,
  type JewelryType,
  type TenantId,
  type StoreId,
  type PricingRuleId,
  createEntityId,
  ActorReference,
  ValidationError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
  BusinessRuleViolationError,
  type Result,
  ok,
  err,
} from '@v-gold/core';
import { Decimal } from 'decimal.js';

export interface CreateProductInput {
  tenantId: string;
  storeId?: string | undefined;
  name: string;
  description?: string | undefined;
  productType: JewelryType;
  actorId?: string | undefined;
}

export interface GemstoneInputDto {
  gemstoneType: 'DIAMOND' | 'RUBY' | 'EMERALD' | 'SAPPHIRE' | 'PEARL' | 'OTHER';
  caratWeight: string | number;
  count?: number | undefined;
  color?: string | undefined;
  clarity?: string | undefined;
  cut?: string | undefined;
  certificateNumber?: string | undefined;
  description?: string | undefined;
}

export interface CreateVariantInput {
  productId: string;
  tenantId: string;
  sku: string;
  name: string;
  jewelryType: JewelryType;
  goldPurity: {
    fineness?: string | number | undefined;
    karat?: string | number | undefined;
  };
  goldWeightGrams: string | number;
  grossWeightGrams: string | number;
  gemstones?: GemstoneInputDto[] | undefined;
  pricingRuleId?: string | undefined;
  actorId?: string | undefined;
}

export class CatalogService {
  constructor(
    private readonly productRepo: ProductRepositoryPort,
    private readonly variantRepo: ProductVariantRepositoryPort
  ) {}

  async createProduct(
    input: CreateProductInput
  ): Promise<Result<Product, ValidationError | ForbiddenError>> {
    const tenantId = createEntityId<TenantId>(input.tenantId);
    const storeId = input.storeId ? createEntityId<StoreId>(input.storeId) : undefined;
    const actor = input.actorId
      ? ActorReference.user(input.actorId).unwrapOr(ActorReference.system())
      : ActorReference.system();

    const productRes = Product.create({
      tenantId,
      storeId,
      name: input.name,
      description: input.description,
      productType: input.productType,
      actor,
    });

    if (productRes.isErr) {
      return err(productRes.error);
    }

    const product = productRes.value;
    await this.productRepo.save(product);
    return ok(product);
  }

  async getProduct(
    productId: string,
    tenantId: string
  ): Promise<Result<Product, NotFoundError | ForbiddenError>> {
    const prodId = createEntityId<ProductId>(productId);
    const tenId = createEntityId<TenantId>(tenantId);

    const product = await this.productRepo.findById(prodId, tenId);
    if (!product) {
      // Check if product exists under another tenant to distinguish 404 vs 403
      const anyProduct = await this.productRepo.findById(prodId);
      if (anyProduct && anyProduct.tenantId !== tenId) {
        return err(new ForbiddenError('Access to product from different tenant is denied.'));
      }
      return err(new NotFoundError(`Product "${productId}" not found.`));
    }

    return ok(product);
  }

  async listProducts(tenantId: string, filter?: ProductListFilter): Promise<Product[]> {
    const tenId = createEntityId<TenantId>(tenantId);
    return this.productRepo.listByTenant(tenId, filter);
  }

  async publishProduct(
    productId: string,
    tenantId: string,
    actorId?: string
  ): Promise<Result<Product, NotFoundError | ForbiddenError | ValidationError | BusinessRuleViolationError>> {
    const fetchRes = await this.getProduct(productId, tenantId);
    if (fetchRes.isErr) return err(fetchRes.error);

    const product = fetchRes.value;
    const actor = actorId
      ? ActorReference.user(actorId).unwrapOr(ActorReference.system())
      : ActorReference.system();

    const pubRes = product.publish(actor);
    if (pubRes.isErr) return err(pubRes.error);

    await this.productRepo.save(product);
    return ok(product);
  }

  async archiveProduct(
    productId: string,
    tenantId: string,
    actorId?: string
  ): Promise<Result<Product, NotFoundError | ForbiddenError | ValidationError | BusinessRuleViolationError>> {
    const fetchRes = await this.getProduct(productId, tenantId);
    if (fetchRes.isErr) return err(fetchRes.error);

    const product = fetchRes.value;
    const actor = actorId
      ? ActorReference.user(actorId).unwrapOr(ActorReference.system())
      : ActorReference.system();

    const archRes = product.archive(actor);
    if (archRes.isErr) return err(archRes.error);

    await this.productRepo.save(product);
    return ok(product);
  }

  async createVariant(
    input: CreateVariantInput
  ): Promise<Result<ProductVariant, ValidationError | ConflictError | NotFoundError | ForbiddenError>> {
    const tenId = createEntityId<TenantId>(input.tenantId);
    const prodId = createEntityId<ProductId>(input.productId);

    // 1. Verify parent product belongs to same tenant
    const productRes = await this.getProduct(input.productId, input.tenantId);
    if (productRes.isErr) return err(productRes.error);

    // 2. Validate and Parse SKU
    const skuRes = SKU.create(input.sku);
    if (skuRes.isErr) return err(skuRes.error);
    const sku = skuRes.value;

    // 3. Verify SKU uniqueness within tenant
    const existingSku = await this.variantRepo.findBySku(sku, tenId);
    if (existingSku) {
      return err(new ConflictError(`SKU "${sku.value}" already exists for tenant "${input.tenantId}".`));
    }

    // 4. Validate Gold Purity
    let purity: GoldPurity;
    if (input.goldPurity.fineness !== undefined) {
      const pRes = GoldPurity.fromFineness(new Decimal(input.goldPurity.fineness));
      if (pRes.isErr) return err(pRes.error);
      purity = pRes.value;
    } else if (input.goldPurity.karat !== undefined) {
      const pRes = GoldPurity.fromKarat(new Decimal(input.goldPurity.karat));
      if (pRes.isErr) return err(pRes.error);
      purity = pRes.value;
    } else {
      return err(new ValidationError('Either fineness or karat must be provided for gold purity.'));
    }

    // 5. Validate Gold Mass and Gross Mass
    const goldWeightRes = Weight.fromGrams(input.goldWeightGrams.toString());
    if (goldWeightRes.isErr) return err(goldWeightRes.error);

    const grossWeightRes = Weight.fromGrams(input.grossWeightGrams.toString());
    if (grossWeightRes.isErr) return err(grossWeightRes.error);

    const metalRes = MaterialSpecification.gold(purity, goldWeightRes.value);
    if (metalRes.isErr) return err(metalRes.error);

    // 6. Validate Gemstones if present
    const gemstones: GemstoneSpecification[] = [];
    if (input.gemstones && input.gemstones.length > 0) {
      for (const stoneInput of input.gemstones) {
        const stoneRes = GemstoneSpecification.create({
          gemstoneType: stoneInput.gemstoneType,
          carats: stoneInput.caratWeight,
          count: stoneInput.count,
          color: stoneInput.color,
          clarity: stoneInput.clarity,
          cut: stoneInput.cut,
          certificateNumber: stoneInput.certificateNumber,
          description: stoneInput.description,
        });
        if (stoneRes.isErr) return err(stoneRes.error);
        gemstones.push(stoneRes.value);
      }
    }

    // 7. Validate JewelrySpecification physical invariants
    const specRes = JewelrySpecification.create({
      jewelryType: input.jewelryType,
      metal: metalRes.value,
      grossWeight: grossWeightRes.value,
      gemstones,
    });
    if (specRes.isErr) return err(specRes.error);

    const actor = input.actorId
      ? ActorReference.user(input.actorId).unwrapOr(ActorReference.system())
      : ActorReference.system();

    const variantRes = ProductVariant.create({
      productId: prodId,
      tenantId: tenId,
      sku,
      name: input.name,
      specification: specRes.value,
      pricingRuleId: input.pricingRuleId ? createEntityId<PricingRuleId>(input.pricingRuleId) : undefined,
      actor,
    });

    if (variantRes.isErr) return err(variantRes.error);

    const variant = variantRes.value;
    await this.variantRepo.save(variant);
    return ok(variant);
  }

  async getVariant(
    variantId: string,
    tenantId: string
  ): Promise<Result<ProductVariant, NotFoundError | ForbiddenError>> {
    const varId = createEntityId<ProductVariantId>(variantId);
    const tenId = createEntityId<TenantId>(tenantId);

    const variant = await this.variantRepo.findById(varId, tenId);
    if (!variant) {
      const anyVariant = await this.variantRepo.findById(varId);
      if (anyVariant && anyVariant.tenantId !== tenId) {
        return err(new ForbiddenError('Access to variant from different tenant is denied.'));
      }
      return err(new NotFoundError(`Variant "${variantId}" not found.`));
    }

    return ok(variant);
  }

  async getVariantBySku(
    sku: string,
    tenantId: string
  ): Promise<Result<ProductVariant, NotFoundError>> {
    const tenId = createEntityId<TenantId>(tenantId);
    const variant = await this.variantRepo.findBySku(sku, tenId);
    if (!variant) {
      return err(new NotFoundError(`Variant with SKU "${sku}" not found.`));
    }
    return ok(variant);
  }

  async listVariantsByProduct(productId: string, tenantId: string): Promise<ProductVariant[]> {
    const prodId = createEntityId<ProductId>(productId);
    const tenId = createEntityId<TenantId>(tenantId);
    return this.variantRepo.listByProductId(prodId, tenId);
  }

  async listVariants(tenantId: string, filter?: ProductVariantListFilter): Promise<ProductVariant[]> {
    const tenId = createEntityId<TenantId>(tenantId);
    return this.variantRepo.listByTenant(tenId, filter);
  }
}
