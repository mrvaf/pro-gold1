import {
  type TrustSafetyRepositoryPort,
  GuildLicense,
  HallmarkAuditRecord,
  CustomerReview,
  type TenantId,
  type LicenseStatus,
  type ModerationStatus,
} from '@v-gold/core';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { eq, and, count } from 'drizzle-orm';
import {
  guildLicensesTable,
  hallmarkAuditRecordsTable,
  customerReviewsTable,
} from '../schema/trust-safety.js';

export class DrizzleTrustSafetyRepository implements TrustSafetyRepositoryPort {
  constructor(private readonly db: PgDatabase<any, any, any>) {}

  async saveGuildLicense(license: GuildLicense): Promise<void> {
    const raw = license.toJSON();
    await this.db
      .insert(guildLicensesTable)
      .values({
        id: raw.id,
        tenantId: raw.tenantId,
        sellerProfileId: raw.sellerProfileId,
        guildRegistrationNumber: raw.guildRegistrationNumber,
        guildName: raw.guildName,
        issuanceDate: raw.issuanceDate,
        expiryDate: raw.expiryDate,
        status: raw.status,
        verifiedAt: raw.verifiedAt ?? null,
        rejectedReason: raw.rejectedReason ?? null,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
      })
      .onConflictDoUpdate({
        target: guildLicensesTable.id,
        set: {
          guildRegistrationNumber: raw.guildRegistrationNumber,
          guildName: raw.guildName,
          issuanceDate: raw.issuanceDate,
          expiryDate: raw.expiryDate,
          status: raw.status,
          verifiedAt: raw.verifiedAt ?? null,
          rejectedReason: raw.rejectedReason ?? null,
          updatedAt: raw.updatedAt,
        },
      });
  }

  async findGuildLicenseById(id: string, tenantId: TenantId): Promise<GuildLicense | null> {
    const rows = await this.db
      .select()
      .from(guildLicensesTable)
      .where(and(eq(guildLicensesTable.id, id), eq(guildLicensesTable.tenantId, tenantId)))
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapLicenseToDomain(rows[0]!);
  }

  async findGuildLicenseBySeller(sellerProfileId: string, tenantId: TenantId): Promise<GuildLicense | null> {
    const rows = await this.db
      .select()
      .from(guildLicensesTable)
      .where(
        and(
          eq(guildLicensesTable.sellerProfileId, sellerProfileId),
          eq(guildLicensesTable.tenantId, tenantId)
        )
      )
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapLicenseToDomain(rows[0]!);
  }

  async saveHallmarkAudit(record: HallmarkAuditRecord): Promise<void> {
    const raw = record.toJSON();
    await this.db
      .insert(hallmarkAuditRecordsTable)
      .values({
        id: raw.id,
        tenantId: raw.tenantId,
        inventoryItemId: raw.inventoryItemId ?? null,
        productVariantId: raw.productVariantId ?? null,
        hallmarkCode: raw.hallmarkCode,
        labAuthority: raw.labAuthority,
        verifiedFineness: raw.verifiedFineness,
        auditNotes: raw.auditNotes ?? null,
        auditedAt: raw.auditedAt,
      })
      .onConflictDoUpdate({
        target: hallmarkAuditRecordsTable.id,
        set: {
          hallmarkCode: raw.hallmarkCode,
          labAuthority: raw.labAuthority,
          verifiedFineness: raw.verifiedFineness,
          auditNotes: raw.auditNotes ?? null,
          auditedAt: raw.auditedAt,
        },
      });
  }

  async findHallmarkAuditsByTenant(tenantId: TenantId): Promise<HallmarkAuditRecord[]> {
    const rows = await this.db
      .select()
      .from(hallmarkAuditRecordsTable)
      .where(eq(hallmarkAuditRecordsTable.tenantId, tenantId));

    return rows.map((r: any) => this.mapHallmarkToDomain(r));
  }

  async countHallmarkAuditsByTenant(tenantId: TenantId): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(hallmarkAuditRecordsTable)
      .where(eq(hallmarkAuditRecordsTable.tenantId, tenantId));

    return Number(result[0]?.count ?? 0);
  }

  async saveReview(review: CustomerReview): Promise<void> {
    const raw = review.toJSON();
    await this.db
      .insert(customerReviewsTable)
      .values({
        id: raw.id,
        tenantId: raw.tenantId,
        orderId: raw.orderId,
        customerId: raw.customerId,
        sellerProfileId: raw.sellerProfileId,
        rating: raw.rating,
        title: raw.title,
        comment: raw.comment,
        isVerifiedPurchase: raw.isVerifiedPurchase,
        moderationStatus: raw.moderationStatus,
        moderationNotes: raw.moderationNotes ?? null,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
      })
      .onConflictDoUpdate({
        target: customerReviewsTable.id,
        set: {
          rating: raw.rating,
          title: raw.title,
          comment: raw.comment,
          isVerifiedPurchase: raw.isVerifiedPurchase,
          moderationStatus: raw.moderationStatus,
          moderationNotes: raw.moderationNotes ?? null,
          updatedAt: raw.updatedAt,
        },
      });
  }

  async findReviewById(id: string, tenantId: TenantId): Promise<CustomerReview | null> {
    const rows = await this.db
      .select()
      .from(customerReviewsTable)
      .where(and(eq(customerReviewsTable.id, id), eq(customerReviewsTable.tenantId, tenantId)))
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapReviewToDomain(rows[0]!);
  }

  async findReviewsBySeller(sellerProfileId: string, tenantId: TenantId): Promise<CustomerReview[]> {
    const rows = await this.db
      .select()
      .from(customerReviewsTable)
      .where(
        and(
          eq(customerReviewsTable.sellerProfileId, sellerProfileId),
          eq(customerReviewsTable.tenantId, tenantId)
        )
      );

    return rows.map((r: any) => this.mapReviewToDomain(r));
  }

  private mapLicenseToDomain(row: any): GuildLicense {
    return GuildLicense.create({
      id: row.id,
      tenantId: row.tenantId,
      sellerProfileId: row.sellerProfileId,
      guildRegistrationNumber: row.guildRegistrationNumber,
      guildName: row.guildName,
      issuanceDate: new Date(row.issuanceDate),
      expiryDate: new Date(row.expiryDate),
      status: row.status as LicenseStatus,
      verifiedAt: row.verifiedAt ? new Date(row.verifiedAt) : undefined,
      rejectedReason: row.rejectedReason ?? undefined,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    });
  }

  private mapHallmarkToDomain(row: any): HallmarkAuditRecord {
    return HallmarkAuditRecord.create({
      id: row.id,
      tenantId: row.tenantId,
      inventoryItemId: row.inventoryItemId ?? undefined,
      productVariantId: row.productVariantId ?? undefined,
      hallmarkCode: row.hallmarkCode,
      labAuthority: row.labAuthority,
      verifiedFineness: row.verifiedFineness,
      auditNotes: row.auditNotes ?? undefined,
      auditedAt: new Date(row.auditedAt),
    });
  }

  private mapReviewToDomain(row: any): CustomerReview {
    return CustomerReview.create({
      id: row.id,
      tenantId: row.tenantId,
      orderId: row.orderId,
      customerId: row.customerId,
      sellerProfileId: row.sellerProfileId,
      rating: row.rating,
      title: row.title,
      comment: row.comment,
      isVerifiedPurchase: row.isVerifiedPurchase,
      moderationStatus: row.moderationStatus as ModerationStatus,
      moderationNotes: row.moderationNotes ?? undefined,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    });
  }
}
