import { and, eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  type RfqRepositoryPort,
  CustomManufacturingRfq,
  type RfqId,
  type TenantId,
  type UserId,
  type RfqProposalId,
  RfqProposal,
  MilestoneQuote,
  RfqMessage,
  Money,
  createEntityId,
} from '@v-gold/core';
import {
  customManufacturingRfqsTable,
  type InsertCustomManufacturingRfqRecord,
} from '../schema/custom-manufacturing-rfqs.js';

export class DrizzleRfqRepository implements RfqRepositoryPort {
  constructor(private readonly db: PgDatabase<any, any, any>) {}

  async save(rfq: CustomManufacturingRfq): Promise<void> {
    const record: InsertCustomManufacturingRfqRecord = {
      id: rfq.id,
      tenantId: rfq.tenantId,
      customerId: rfq.customerId,
      sellerId: rfq.sellerId ?? null,
      assignedGoldsmithId: rfq.assignedGoldsmithId ?? null,
      acceptedProposalId: rfq.acceptedProposalId ?? null,
      status: rfq.status,
      specificationJson: JSON.stringify(rfq.toDto().specification),
      proposalsJson: JSON.stringify(rfq.toDto().proposals),
      messagesJson: JSON.stringify(rfq.toDto().messages),
      createdAt: rfq.createdAt,
      updatedAt: rfq.updatedAt,
    };

    await this.db
      .insert(customManufacturingRfqsTable)
      .values(record)
      .onConflictDoUpdate({
        target: customManufacturingRfqsTable.id,
        set: {
          sellerId: record.sellerId,
          assignedGoldsmithId: record.assignedGoldsmithId,
          acceptedProposalId: record.acceptedProposalId,
          status: record.status,
          specificationJson: record.specificationJson,
          proposalsJson: record.proposalsJson,
          messagesJson: record.messagesJson,
          updatedAt: new Date(),
        },
      });
  }

  async findById(id: RfqId, tenantId?: TenantId): Promise<CustomManufacturingRfq | null> {
    const conditions = [eq(customManufacturingRfqsTable.id, id)];
    if (tenantId) {
      conditions.push(eq(customManufacturingRfqsTable.tenantId, tenantId));
    }

    const rows = await this.db
      .select()
      .from(customManufacturingRfqsTable)
      .where(and(...conditions))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return this.mapToDomain(row);
  }

  async listByParticipant(userId: UserId, tenantId: TenantId): Promise<CustomManufacturingRfq[]> {
    const rows = await this.db
      .select()
      .from(customManufacturingRfqsTable)
      .where(eq(customManufacturingRfqsTable.tenantId, tenantId));

    return rows
      .map((r) => this.mapToDomain(r))
      .filter(
        (rfq) =>
          rfq.customerId === userId ||
          rfq.sellerId === userId ||
          rfq.assignedGoldsmithId === userId ||
          rfq.proposals.some((p) => p.goldsmithId === userId)
      );
  }

  async delete(id: RfqId, tenantId?: TenantId): Promise<void> {
    const conditions = [eq(customManufacturingRfqsTable.id, id)];
    if (tenantId) {
      conditions.push(eq(customManufacturingRfqsTable.tenantId, tenantId));
    }
    await this.db.delete(customManufacturingRfqsTable).where(and(...conditions));
  }

  async count(tenantId?: TenantId): Promise<number> {
    const rows = tenantId
      ? await this.db
          .select()
          .from(customManufacturingRfqsTable)
          .where(eq(customManufacturingRfqsTable.tenantId, tenantId))
      : await this.db.select().from(customManufacturingRfqsTable);
    return rows.length;
  }

  private mapToDomain(row: typeof customManufacturingRfqsTable.$inferSelect): CustomManufacturingRfq {
    const specData = JSON.parse(row.specificationJson);
    const proposalsData: any[] = JSON.parse(row.proposalsJson);
    const messagesData: any[] = JSON.parse(row.messagesJson);

    const proposals: RfqProposal[] = proposalsData.map((p) => {
      const milestones = (p.milestones || []).map((m: any) =>
        MilestoneQuote.create({
          milestoneId: m.milestoneId,
          title: m.title,
          description: m.description,
          targetDays: m.targetDays,
          costAmount: Money.create(m.costAmount, m.currency).unwrap(),
        })
      );

      const prop = new RfqProposal(createEntityId<RfqProposalId>(p.id), {
        rfqId: p.rfqId,
        goldsmithId: createEntityId<UserId>(p.goldsmithId),
        goldsmithName: p.goldsmithName,
        estimatedDays: p.estimatedDays,
        totalQuote: Money.create(p.totalQuote, p.currency).unwrap(),
        milestones,
        notes: p.notes,
        status: p.status,
        submittedAt: new Date(p.submittedAt),
      });

      return prop;
    });

    const messages: RfqMessage[] = messagesData.map((m) =>
      RfqMessage.create({
        messageId: m.messageId,
        senderId: createEntityId<UserId>(m.senderId),
        senderRole: m.senderRole,
        content: m.content,
        sentAt: new Date(m.sentAt),
      })
    );

    return CustomManufacturingRfq.reconstitute(createEntityId<RfqId>(row.id), {
      tenantId: createEntityId<TenantId>(row.tenantId),
      customerId: createEntityId<UserId>(row.customerId),
      sellerId: row.sellerId ? createEntityId<UserId>(row.sellerId) : undefined,
      assignedGoldsmithId: row.assignedGoldsmithId ? createEntityId<UserId>(row.assignedGoldsmithId) : undefined,
      acceptedProposalId: row.acceptedProposalId ? createEntityId<RfqProposalId>(row.acceptedProposalId) : undefined,
      specification: {
        title: specData.title,
        description: specData.description,
        jewelryType: specData.jewelryType,
        targetMetal: specData.targetMetal,
        targetKarat: specData.targetKarat,
        estimatedWeightGrams: specData.estimatedWeightGrams,
        referenceAssetUrl: specData.referenceAssetUrl,
        targetBudget: specData.targetBudget
          ? Money.create(specData.targetBudget, specData.currency).unwrap()
          : undefined,
      },
      status: row.status as any,
      proposals,
      messages,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
