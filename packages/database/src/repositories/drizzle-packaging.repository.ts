import { eq, and } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  type PackagingRepositoryPort,
  PackagingSpecification,
  BoxDimensions,
  Money,
  createEntityId,
  type PackagingSpecId,
  type TenantId,
  type ProductId,
  type BoxMaterial,
  type LuxuryTier,
  type DielineSpecification,
} from '@v-gold/core';
import { packagingSpecificationsTable } from '../schema/packaging.js';

export class DrizzlePackagingRepository implements PackagingRepositoryPort {
  constructor(private readonly db: PgDatabase<any, any, any>) {}

  private mapToDomain(row: typeof packagingSpecificationsTable.$inferSelect): PackagingSpecification {
    const rawDim = row.dimensions as { widthMm: number; lengthMm: number; heightMm: number };
    const dimensions = BoxDimensions.create({
      widthMm: Number(rawDim.widthMm),
      lengthMm: Number(rawDim.lengthMm),
      heightMm: Number(rawDim.heightMm),
    }).unwrap();

    const rawCost = row.productionCost as { amount: string; currency: 'USD' | 'EUR' | 'IRR' | 'TOMAN' };
    const productionCost = Money.create(rawCost.amount, rawCost.currency).unwrap();

    return new PackagingSpecification(createEntityId<PackagingSpecId>(row.id), {
      tenantId: createEntityId<TenantId>(row.tenantId),
      productId: row.productId ? createEntityId<ProductId>(row.productId) : undefined,
      name: row.name,
      dimensions,
      material: row.material as BoxMaterial,
      tier: row.tier as LuxuryTier,
      primaryColorHex: row.primaryColorHex,
      accentColorHex: row.accentColorHex ?? undefined,
      hasCustomDieline: row.hasCustomDieline,
      hasFoilEmbossing: row.hasFoilEmbossing,
      dieline: (row.dieline as DielineSpecification | null) ?? undefined,
      productionCost,
      aiPreviewImageUrl: row.aiPreviewImageUrl ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async save(spec: PackagingSpecification): Promise<void> {
    await this.db
      .insert(packagingSpecificationsTable)
      .values({
        id: spec.id,
        tenantId: spec.tenantId,
        productId: spec.productId ?? null,
        name: spec.name,
        dimensions: spec.dimensions.toJSON(),
        material: spec.material,
        tier: spec.tier,
        primaryColorHex: spec.primaryColorHex,
        accentColorHex: spec.accentColorHex ?? null,
        hasCustomDieline: spec.hasCustomDieline,
        hasFoilEmbossing: spec.hasFoilEmbossing,
        dieline: spec.dieline ?? null,
        productionCost: {
          amount: spec.productionCost.amount.toString(),
          currency: spec.productionCost.currency,
        },
        aiPreviewImageUrl: spec.aiPreviewImageUrl ?? null,
        createdAt: spec.createdAt,
        updatedAt: spec.updatedAt,
      })
      .onConflictDoUpdate({
        target: packagingSpecificationsTable.id,
        set: {
          productId: spec.productId ?? null,
          name: spec.name,
          dimensions: spec.dimensions.toJSON(),
          material: spec.material,
          tier: spec.tier,
          primaryColorHex: spec.primaryColorHex,
          accentColorHex: spec.accentColorHex ?? null,
          hasCustomDieline: spec.hasCustomDieline,
          hasFoilEmbossing: spec.hasFoilEmbossing,
          dieline: spec.dieline ?? null,
          productionCost: {
            amount: spec.productionCost.amount.toString(),
            currency: spec.productionCost.currency,
          },
          aiPreviewImageUrl: spec.aiPreviewImageUrl ?? null,
          updatedAt: spec.updatedAt,
        },
      });
  }

  async findById(id: PackagingSpecId, tenantId: TenantId): Promise<PackagingSpecification | null> {
    const rows = await this.db
      .select()
      .from(packagingSpecificationsTable)
      .where(
        and(
          eq(packagingSpecificationsTable.id, id),
          eq(packagingSpecificationsTable.tenantId, tenantId)
        )
      )
      .limit(1);

    if (rows.length === 0 || !rows[0]) {
      return null;
    }

    return this.mapToDomain(rows[0]);
  }

  async findByProductId(productId: string, tenantId: TenantId): Promise<PackagingSpecification[]> {
    const rows = await this.db
      .select()
      .from(packagingSpecificationsTable)
      .where(
        and(
          eq(packagingSpecificationsTable.productId, productId),
          eq(packagingSpecificationsTable.tenantId, tenantId)
        )
      );

    return rows.map((r) => this.mapToDomain(r));
  }

  async findByTenantId(tenantId: TenantId): Promise<PackagingSpecification[]> {
    const rows = await this.db
      .select()
      .from(packagingSpecificationsTable)
      .where(eq(packagingSpecificationsTable.tenantId, tenantId));

    return rows.map((r) => this.mapToDomain(r));
  }

  async delete(id: PackagingSpecId, tenantId: TenantId): Promise<boolean> {
    const result = await this.db
      .delete(packagingSpecificationsTable)
      .where(
        and(
          eq(packagingSpecificationsTable.id, id),
          eq(packagingSpecificationsTable.tenantId, tenantId)
        )
      );

    return (result.rowCount ?? 0) > 0;
  }
}
