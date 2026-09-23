import { and, desc, eq, sql } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  type InventoryItemRepositoryPort,
  type InventoryItemListFilter,
  InventoryItem,
  type InventoryItemId,
  type InventoryLocationId,
  type InventoryStatus,
  type ProductVariantId,
  SKU,
  Weight,
  GoldPurity,
  type TenantId,
  type StoreId,
  createEntityId,
  AuditMetadata,
  ActorReference,
} from '@v-gold/core';
import {
  inventoryItemsTable,
  type InventoryItemRecord,
  type InsertInventoryItemRecord,
} from '../schema/inventory-items.js';
import { Decimal } from 'decimal.js';

export const toDomainInventoryItem = (record: InventoryItemRecord): InventoryItem => {
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
  const grossWeight = Weight.fromGrams(record.grossWeightGrams).unwrap();
  const goldWeight = Weight.fromGrams(record.goldWeightGrams).unwrap();
  const purity = GoldPurity.fromFineness(record.purityFineness).unwrap();

  return InventoryItem.reconstitute(
    createEntityId<InventoryItemId>(record.id),
    createEntityId<TenantId>(record.tenantId),
    record.storeId ? createEntityId<StoreId>(record.storeId) : undefined,
    createEntityId<ProductVariantId>(record.productVariantId),
    sku,
    record.serialNumber ?? undefined,
    record.barcode ?? undefined,
    createEntityId<InventoryLocationId>(record.locationId),
    record.status as InventoryStatus,
    new Decimal(record.quantity),
    grossWeight,
    goldWeight,
    purity,
    record.passportRef ?? undefined,
    audit
  );
};

export const toDatabaseInventoryItem = (item: InventoryItem): InsertInventoryItemRecord => ({
  id: item.id,
  tenantId: item.tenantId,
  storeId: item.storeId ?? null,
  productVariantId: item.productVariantId,
  sku: item.sku.value,
  serialNumber: item.serialNumber ?? null,
  barcode: item.barcode ?? null,
  locationId: item.locationId,
  status: item.status,
  quantity: item.quantity.toString(),
  grossWeightGrams: item.grossWeight.grams.toString(),
  goldWeightGrams: item.goldWeight.grams.toString(),
  purityFineness: item.purity.fineness.toString(),
  purityKarat: item.purity.karat.toString(),
  passportRef: item.passportRef ?? null,
  createdAt: item.audit.createdAt,
  updatedAt: item.audit.updatedAt,
  createdByActorId: item.audit.createdBy?.actorId ?? null,
  updatedByActorId: item.audit.updatedBy?.actorId ?? null,
});

export class DrizzleInventoryItemRepository implements InventoryItemRepositoryPort {
  constructor(private readonly db: PgDatabase<any>) {}

  async save(item: InventoryItem): Promise<void> {
    const record = toDatabaseInventoryItem(item);
    await this.db
      .insert(inventoryItemsTable)
      .values(record)
      .onConflictDoUpdate({
        target: inventoryItemsTable.id,
        set: {
          locationId: record.locationId,
          status: record.status,
          quantity: record.quantity,
          updatedAt: record.updatedAt,
          updatedByActorId: record.updatedByActorId,
        },
      });
  }

  async findById(id: InventoryItemId, tenantId?: TenantId): Promise<InventoryItem | null> {
    const conditions = [eq(inventoryItemsTable.id, id)];
    if (tenantId !== undefined) {
      conditions.push(eq(inventoryItemsTable.tenantId, tenantId));
    }

    const records = await this.db
      .select()
      .from(inventoryItemsTable)
      .where(and(...conditions))
      .limit(1);

    const record = records[0];
    return record ? toDomainInventoryItem(record) : null;
  }

  async findBySerialNumber(serial: string, tenantId: TenantId): Promise<InventoryItem | null> {
    const trimmed = serial.trim();
    const records = await this.db
      .select()
      .from(inventoryItemsTable)
      .where(
        and(
          eq(inventoryItemsTable.tenantId, tenantId),
          eq(inventoryItemsTable.serialNumber, trimmed)
        )
      )
      .limit(1);

    const record = records[0];
    return record ? toDomainInventoryItem(record) : null;
  }

  async listByVariantId(
    variantId: ProductVariantId,
    tenantId: TenantId
  ): Promise<InventoryItem[]> {
    const records = await this.db
      .select()
      .from(inventoryItemsTable)
      .where(
        and(
          eq(inventoryItemsTable.tenantId, tenantId),
          eq(inventoryItemsTable.productVariantId, variantId)
        )
      )
      .orderBy(desc(inventoryItemsTable.createdAt));

    return records.map(toDomainInventoryItem);
  }

  async listByLocation(
    locationId: InventoryLocationId,
    tenantId: TenantId
  ): Promise<InventoryItem[]> {
    const records = await this.db
      .select()
      .from(inventoryItemsTable)
      .where(
        and(
          eq(inventoryItemsTable.tenantId, tenantId),
          eq(inventoryItemsTable.locationId, locationId)
        )
      )
      .orderBy(desc(inventoryItemsTable.createdAt));

    return records.map(toDomainInventoryItem);
  }

  async listByTenant(
    tenantId: TenantId,
    filter?: InventoryItemListFilter
  ): Promise<InventoryItem[]> {
    const conditions = [eq(inventoryItemsTable.tenantId, tenantId)];

    if (filter?.status) {
      conditions.push(eq(inventoryItemsTable.status, filter.status));
    }

    let query = this.db
      .select()
      .from(inventoryItemsTable)
      .where(and(...conditions))
      .orderBy(desc(inventoryItemsTable.createdAt));

    if (filter?.limit !== undefined) {
      query = query.limit(filter.limit) as any;
    }
    if (filter?.offset !== undefined) {
      query = query.offset(filter.offset) as any;
    }

    const records = await query;
    return records.map(toDomainInventoryItem);
  }

  async count(tenantId?: TenantId): Promise<number> {
    const conditions = tenantId ? [eq(inventoryItemsTable.tenantId, tenantId)] : [];
    const records = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(inventoryItemsTable)
      .where(and(...conditions));

    return Number(records[0]?.count ?? 0);
  }
}
