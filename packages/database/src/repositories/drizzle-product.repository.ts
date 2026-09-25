import { and, desc, eq, sql } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  type ProductRepositoryPort,
  type ProductListFilter,
  Product,
  type ProductId,
  type ProductStatus,
  type JewelryType,
  type TenantId,
  type StoreId,
  createEntityId,
  AuditMetadata,
  ActorReference,
} from '@v-gold/core';
import { productsTable, type ProductRecord, type InsertProductRecord } from '../schema/products.js';

export const toDomainProduct = (record: ProductRecord): Product => {
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

  return Product.reconstitute(
    createEntityId<ProductId>(record.id),
    createEntityId<TenantId>(record.tenantId),
    record.storeId ? createEntityId<StoreId>(record.storeId) : undefined,
    record.name,
    record.description ?? undefined,
    record.productType as JewelryType,
    record.status as ProductStatus,
    audit
  );
};

export const toDatabaseProduct = (product: Product): InsertProductRecord => ({
  id: product.id,
  tenantId: product.tenantId,
  storeId: product.storeId ?? null,
  name: product.name,
  description: product.description ?? null,
  productType: product.productType,
  status: product.status,
  createdAt: product.audit.createdAt,
  updatedAt: product.audit.updatedAt,
  createdByActorId: product.audit.createdBy?.actorId ?? null,
  updatedByActorId: product.audit.updatedBy?.actorId ?? null,
});

export class DrizzleProductRepository implements ProductRepositoryPort {
  constructor(private readonly db: PgDatabase<any, any, any>) {}

  async save(product: Product): Promise<void> {
    const record = toDatabaseProduct(product);
    await this.db
      .insert(productsTable)
      .values(record)
      .onConflictDoUpdate({
        target: productsTable.id,
        set: {
          name: record.name,
          description: record.description,
          status: record.status,
          updatedAt: record.updatedAt,
          updatedByActorId: record.updatedByActorId,
        },
      });
  }

  async findById(id: ProductId, tenantId?: TenantId): Promise<Product | null> {
    const conditions = [eq(productsTable.id, id)];
    if (tenantId !== undefined) {
      conditions.push(eq(productsTable.tenantId, tenantId));
    }

    const records = await this.db
      .select()
      .from(productsTable)
      .where(and(...conditions))
      .limit(1);

    const record = records[0];
    return record ? toDomainProduct(record) : null;
  }

  async listByTenant(tenantId: TenantId, filter?: ProductListFilter): Promise<Product[]> {
    const conditions = [eq(productsTable.tenantId, tenantId)];

    if (filter?.status) {
      conditions.push(eq(productsTable.status, filter.status));
    }
    if (filter?.productType) {
      conditions.push(eq(productsTable.productType, filter.productType));
    }

    let query = this.db
      .select()
      .from(productsTable)
      .where(and(...conditions))
      .orderBy(desc(productsTable.createdAt));

    if (filter?.limit !== undefined) {
      query = query.limit(filter.limit) as any;
    }
    if (filter?.offset !== undefined) {
      query = query.offset(filter.offset) as any;
    }

    const records = await query;
    return records.map(toDomainProduct);
  }

  async count(tenantId?: TenantId): Promise<number> {
    const conditions = tenantId ? [eq(productsTable.tenantId, tenantId)] : [];
    const records = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(productsTable)
      .where(and(...conditions));

    return Number(records[0]?.count ?? 0);
  }
}
