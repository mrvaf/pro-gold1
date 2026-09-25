import { and, desc, eq, sql } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  type ProductVariantRepositoryPort,
  type ProductVariantListFilter,
  ProductVariant,
  type ProductVariantId,
  type ProductVariantStatus,
  type ProductId,
  SKU,
  type TenantId,
  type PricingRuleId,
  createEntityId,
  AuditMetadata,
  ActorReference,
  Weight,
  GoldPurity,
  MaterialSpecification,
  JewelrySpecification,
  GemstoneSpecification,
  type JewelryType,
} from '@v-gold/core';
import {
  productVariantsTable,
  type ProductVariantRecord,
  type InsertProductVariantRecord,
} from '../schema/product-variants.js';

export const toDomainProductVariant = (record: ProductVariantRecord): ProductVariant => {
  const createdBy = record.createdByActorId
    ? ActorReference.create(record.createdByActorId, 'USER').unwrapOr(undefined as any)
    : undefined;
  const updatedBy = record.updatedByActorId
    ? ActorReference.create(record.updatedByActorId, 'USER').unwrapOr(undefined as any)
    : undefined;

  const audit = AuditMetadata.fromDates(
    record.createdAt,
    record.updatedAt,
    createdBy,
    updatedBy
  );

  const sku = SKU.create(record.sku).unwrap();
  const purity = GoldPurity.fromFineness(record.goldPurityFineness).unwrap();
  const goldWeight = Weight.fromGrams(record.goldWeightGrams).unwrap();
  const metal = MaterialSpecification.gold(purity, goldWeight).unwrap();
  const grossWeight = Weight.fromGrams(record.grossWeightGrams).unwrap();

  let gemstones: GemstoneSpecification[] = [];
  if (record.gemstonesJson) {
    try {
      const parsed = JSON.parse(record.gemstonesJson);
      if (Array.isArray(parsed)) {
        gemstones = parsed.map((item: any) =>
          GemstoneSpecification.create({
            gemstoneType: item.gemstoneType,
            carats: item.caratWeight,
            count: item.count,
            color: item.color,
            clarity: item.clarity,
            cut: item.cut,
            certificateNumber: item.certificateNumber,
            description: item.description,
          }).unwrap()
        );
      }
    } catch {
      gemstones = [];
    }
  }

  const spec = JewelrySpecification.create({
    jewelryType: record.jewelryType as JewelryType,
    metal,
    grossWeight,
    gemstones,
  }).unwrap();

  return ProductVariant.reconstitute(
    createEntityId<ProductVariantId>(record.id),
    createEntityId<ProductId>(record.productId),
    createEntityId<TenantId>(record.tenantId),
    sku,
    record.name,
    record.status as ProductVariantStatus,
    spec,
    record.pricingRuleId ? createEntityId<PricingRuleId>(record.pricingRuleId) : undefined,
    audit
  );
};

export const toDatabaseProductVariant = (variant: ProductVariant): InsertProductVariantRecord => {
  const spec = variant.specification;
  const metal = spec.metal;
  const gemstones = spec.gemstones;

  return {
    id: variant.id,
    productId: variant.productId,
    tenantId: variant.tenantId,
    sku: variant.sku.value,
    name: variant.name,
    status: variant.status,
    pricingRuleId: variant.pricingRuleId ?? null,
    jewelryType: spec.jewelryType,
    metalType: metal.materialType,
    goldPurityFineness: metal.purityFineness.toString(),
    goldPurityKarat: metal.goldPurity ? metal.goldPurity.karat.toString() : '0',
    goldWeightGrams: metal.weight.grams.toString(),
    grossWeightGrams: spec.grossWeight.grams.toString(),
    gemstonesJson:
      gemstones.length > 0
        ? JSON.stringify(gemstones.map((g: GemstoneSpecification) => g.toDto()))
        : null,
    createdAt: variant.audit.createdAt,
    updatedAt: variant.audit.updatedAt,
    createdByActorId: variant.audit.createdBy?.actorId ?? null,
    updatedByActorId: variant.audit.updatedBy?.actorId ?? null,
  };
};

export class DrizzleProductVariantRepository implements ProductVariantRepositoryPort {
  constructor(private readonly db: PgDatabase<any, any, any>) {}

  async save(variant: ProductVariant): Promise<void> {
    const record = toDatabaseProductVariant(variant);
    await this.db
      .insert(productVariantsTable)
      .values(record)
      .onConflictDoUpdate({
        target: productVariantsTable.id,
        set: {
          name: record.name,
          status: record.status,
          pricingRuleId: record.pricingRuleId,
          goldPurityFineness: record.goldPurityFineness,
          goldPurityKarat: record.goldPurityKarat,
          goldWeightGrams: record.goldWeightGrams,
          grossWeightGrams: record.grossWeightGrams,
          gemstonesJson: record.gemstonesJson,
          updatedAt: record.updatedAt,
          updatedByActorId: record.updatedByActorId,
        },
      });
  }

  async findById(id: ProductVariantId, tenantId?: TenantId): Promise<ProductVariant | null> {
    const conditions = [eq(productVariantsTable.id, id)];
    if (tenantId !== undefined) {
      conditions.push(eq(productVariantsTable.tenantId, tenantId));
    }

    const records = await this.db
      .select()
      .from(productVariantsTable)
      .where(and(...conditions))
      .limit(1);

    const record = records[0];
    return record ? toDomainProductVariant(record) : null;
  }

  async findBySku(sku: SKU | string, tenantId: TenantId): Promise<ProductVariant | null> {
    const skuStr = typeof sku === 'string' ? sku.trim().toUpperCase() : sku.value;
    const records = await this.db
      .select()
      .from(productVariantsTable)
      .where(
        and(
          eq(productVariantsTable.tenantId, tenantId),
          eq(productVariantsTable.sku, skuStr)
        )
      )
      .limit(1);

    const record = records[0];
    return record ? toDomainProductVariant(record) : null;
  }

  async listByProductId(productId: ProductId, tenantId: TenantId): Promise<ProductVariant[]> {
    const records = await this.db
      .select()
      .from(productVariantsTable)
      .where(
        and(
          eq(productVariantsTable.tenantId, tenantId),
          eq(productVariantsTable.productId, productId)
        )
      )
      .orderBy(desc(productVariantsTable.createdAt));

    return records.map(toDomainProductVariant);
  }

  async listByTenant(
    tenantId: TenantId,
    filter?: ProductVariantListFilter
  ): Promise<ProductVariant[]> {
    const conditions = [eq(productVariantsTable.tenantId, tenantId)];

    if (filter?.status) {
      conditions.push(eq(productVariantsTable.status, filter.status));
    }

    let query = this.db
      .select()
      .from(productVariantsTable)
      .where(and(...conditions))
      .orderBy(desc(productVariantsTable.createdAt));

    if (filter?.limit !== undefined) {
      query = query.limit(filter.limit) as any;
    }
    if (filter?.offset !== undefined) {
      query = query.offset(filter.offset) as any;
    }

    const records = await query;
    return records.map(toDomainProductVariant);
  }

  async count(tenantId?: TenantId): Promise<number> {
    const conditions = tenantId ? [eq(productVariantsTable.tenantId, tenantId)] : [];
    const records = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(productVariantsTable)
      .where(and(...conditions));

    return Number(records[0]?.count ?? 0);
  }
}
