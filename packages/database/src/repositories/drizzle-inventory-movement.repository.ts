import { and, desc, eq, sql } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  type InventoryMovementRepositoryPort,
  type InventoryMovementListFilter,
  InventoryMovement,
  type InventoryMovementId,
  type InventoryItemId,
  type InventoryLocationId,
  type InventoryMovementType,
  type InventoryStatus,
  type TenantId,
  createEntityId,
  ActorReference,
  type ActorType,
} from '@v-gold/core';
import {
  inventoryMovementsTable,
  type InventoryMovementRecord,
  type InsertInventoryMovementRecord,
} from '../schema/inventory-movements.js';
import { Decimal } from 'decimal.js';

export const toDomainInventoryMovement = (
  record: InventoryMovementRecord
): InventoryMovement => {
  const actor = ActorReference.create(
    record.actorId,
    record.actorType as ActorType
  ).unwrap();

  return InventoryMovement.reconstitute(
    createEntityId<InventoryMovementId>(record.id),
    createEntityId<TenantId>(record.tenantId),
    createEntityId<InventoryItemId>(record.inventoryItemId),
    record.movementType as InventoryMovementType,
    record.fromLocationId ? createEntityId<InventoryLocationId>(record.fromLocationId) : undefined,
    record.toLocationId ? createEntityId<InventoryLocationId>(record.toLocationId) : undefined,
    record.fromStatus as InventoryStatus,
    record.toStatus as InventoryStatus,
    new Decimal(record.quantity),
    record.occurredAt,
    actor,
    record.reference ?? undefined,
    record.notes ?? undefined
  );
};

export const toDatabaseInventoryMovement = (
  movement: InventoryMovement
): InsertInventoryMovementRecord => ({
  id: movement.id,
  tenantId: movement.tenantId,
  inventoryItemId: movement.inventoryItemId,
  movementType: movement.movementType,
  fromLocationId: movement.fromLocationId ?? null,
  toLocationId: movement.toLocationId ?? null,
  fromStatus: movement.fromStatus,
  toStatus: movement.toStatus,
  quantity: movement.quantity.toString(),
  occurredAt: movement.occurredAt,
  actorId: movement.actor.actorId,
  actorType: movement.actor.actorType,
  reference: movement.reference ?? null,
  notes: movement.notes ?? null,
});

export class DrizzleInventoryMovementRepository implements InventoryMovementRepositoryPort {
  constructor(private readonly db: PgDatabase<any>) {}

  /**
   * Append-only record insertion.
   */
  async record(movement: InventoryMovement): Promise<void> {
    const record = toDatabaseInventoryMovement(movement);
    await this.db.insert(inventoryMovementsTable).values(record);
  }

  async findById(
    id: InventoryMovementId,
    tenantId?: TenantId
  ): Promise<InventoryMovement | null> {
    const conditions = [eq(inventoryMovementsTable.id, id)];
    if (tenantId !== undefined) {
      conditions.push(eq(inventoryMovementsTable.tenantId, tenantId));
    }

    const records = await this.db
      .select()
      .from(inventoryMovementsTable)
      .where(and(...conditions))
      .limit(1);

    const record = records[0];
    return record ? toDomainInventoryMovement(record) : null;
  }

  async listByItemId(
    itemId: InventoryItemId,
    tenantId: TenantId
  ): Promise<InventoryMovement[]> {
    const records = await this.db
      .select()
      .from(inventoryMovementsTable)
      .where(
        and(
          eq(inventoryMovementsTable.tenantId, tenantId),
          eq(inventoryMovementsTable.inventoryItemId, itemId)
        )
      )
      .orderBy(desc(inventoryMovementsTable.occurredAt));

    return records.map(toDomainInventoryMovement);
  }

  async listByTenant(
    tenantId: TenantId,
    filter?: InventoryMovementListFilter
  ): Promise<InventoryMovement[]> {
    let query = this.db
      .select()
      .from(inventoryMovementsTable)
      .where(eq(inventoryMovementsTable.tenantId, tenantId))
      .orderBy(desc(inventoryMovementsTable.occurredAt));

    if (filter?.limit !== undefined) {
      query = query.limit(filter.limit) as any;
    }
    if (filter?.offset !== undefined) {
      query = query.offset(filter.offset) as any;
    }

    const records = await query;
    return records.map(toDomainInventoryMovement);
  }

  async count(tenantId?: TenantId): Promise<number> {
    const conditions = tenantId ? [eq(inventoryMovementsTable.tenantId, tenantId)] : [];
    const records = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(inventoryMovementsTable)
      .where(and(...conditions));

    return Number(records[0]?.count ?? 0);
  }
}
