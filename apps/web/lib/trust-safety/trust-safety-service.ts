import {
  type TrustSafetyRepositoryPort,
  GuildLicense,
  HallmarkAuditRecord,
  CustomerReview,
  TrustScoreCalculator,
  type TrustScoreBreakdown,
  VerificationRecordNotFoundError,
  ReviewNotFoundError,
  type TenantId,
} from '@v-gold/core';

export interface SubmitGuildLicenseDto {
  tenantId: string;
  sellerProfileId: string;
  guildRegistrationNumber: string;
  guildName: string;
  issuanceDate: Date;
  expiryDate: Date;
}

export interface RecordHallmarkAuditDto {
  tenantId: string;
  inventoryItemId?: string;
  productVariantId?: string;
  hallmarkCode: string;
  labAuthority: string;
  verifiedFineness: number;
  auditNotes?: string;
}

export interface SubmitCustomerReviewDto {
  tenantId: string;
  orderId: string;
  customerId: string;
  sellerProfileId: string;
  rating: number;
  title: string;
  comment: string;
  isVerifiedPurchase?: boolean;
}

export class TrustSafetyService {
  constructor(private readonly repo: TrustSafetyRepositoryPort) {}

  async submitGuildLicense(dto: SubmitGuildLicenseDto): Promise<GuildLicense> {
    const licenseId = `lic_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const license = GuildLicense.create({
      id: licenseId,
      tenantId: dto.tenantId as TenantId,
      sellerProfileId: dto.sellerProfileId,
      guildRegistrationNumber: dto.guildRegistrationNumber,
      guildName: dto.guildName,
      issuanceDate: dto.issuanceDate,
      expiryDate: dto.expiryDate,
      status: 'PENDING',
    });

    await this.repo.saveGuildLicense(license);
    return license;
  }

  async verifyGuildLicense(licenseId: string, tenantId: string): Promise<GuildLicense> {
    const license = await this.repo.findGuildLicenseById(licenseId, tenantId as TenantId);
    if (!license) {
      throw new VerificationRecordNotFoundError(licenseId);
    }
    license.verify();
    await this.repo.saveGuildLicense(license);
    return license;
  }

  async rejectGuildLicense(licenseId: string, tenantId: string, reason: string): Promise<GuildLicense> {
    const license = await this.repo.findGuildLicenseById(licenseId, tenantId as TenantId);
    if (!license) {
      throw new VerificationRecordNotFoundError(licenseId);
    }
    license.reject(reason);
    await this.repo.saveGuildLicense(license);
    return license;
  }

  async recordHallmarkAudit(dto: RecordHallmarkAuditDto): Promise<HallmarkAuditRecord> {
    const auditId = `hlm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const record = HallmarkAuditRecord.create({
      id: auditId,
      tenantId: dto.tenantId as TenantId,
      inventoryItemId: dto.inventoryItemId,
      productVariantId: dto.productVariantId,
      hallmarkCode: dto.hallmarkCode,
      labAuthority: dto.labAuthority,
      verifiedFineness: dto.verifiedFineness,
      auditNotes: dto.auditNotes,
    });

    await this.repo.saveHallmarkAudit(record);
    return record;
  }

  async submitCustomerReview(dto: SubmitCustomerReviewDto): Promise<CustomerReview> {
    const reviewId = `rev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const review = CustomerReview.create({
      id: reviewId,
      tenantId: dto.tenantId as TenantId,
      orderId: dto.orderId,
      customerId: dto.customerId,
      sellerProfileId: dto.sellerProfileId,
      rating: dto.rating,
      title: dto.title,
      comment: dto.comment,
      isVerifiedPurchase: dto.isVerifiedPurchase ?? true,
      moderationStatus: 'PENDING_REVIEW',
    });

    await this.repo.saveReview(review);
    return review;
  }

  async moderateReview(
    reviewId: string,
    tenantId: string,
    action: 'APPROVE' | 'REJECT',
    notes?: string
  ): Promise<CustomerReview> {
    const review = await this.repo.findReviewById(reviewId, tenantId as TenantId);
    if (!review) {
      throw new ReviewNotFoundError(reviewId);
    }

    if (action === 'APPROVE') {
      review.approve(notes);
    } else {
      review.reject(notes ?? 'Violates guidelines');
    }

    await this.repo.saveReview(review);
    return review;
  }

  async getSellerTrustBreakdown(sellerProfileId: string, tenantId: string): Promise<TrustScoreBreakdown> {
    const license = await this.repo.findGuildLicenseBySeller(sellerProfileId, tenantId as TenantId);
    const hallmarkCount = await this.repo.countHallmarkAuditsByTenant(tenantId as TenantId);
    const reviews = await this.repo.findReviewsBySeller(sellerProfileId, tenantId as TenantId);

    return TrustScoreCalculator.calculate({
      license,
      hallmarkAuditCount: hallmarkCount,
      reviews,
    });
  }
}
