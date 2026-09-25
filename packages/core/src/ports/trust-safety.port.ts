import type { TenantId } from '../domain/tenant/tenant.js';
import type { GuildLicense, HallmarkAuditRecord } from '../domain/trust-safety/guild-verification.js';
import type { CustomerReview } from '../domain/trust-safety/customer-review.js';

export interface TrustSafetyRepositoryPort {
  saveGuildLicense(license: GuildLicense): Promise<void>;
  findGuildLicenseById(id: string, tenantId: TenantId): Promise<GuildLicense | null>;
  findGuildLicenseBySeller(sellerProfileId: string, tenantId: TenantId): Promise<GuildLicense | null>;

  saveHallmarkAudit(record: HallmarkAuditRecord): Promise<void>;
  findHallmarkAuditsByTenant(tenantId: TenantId): Promise<HallmarkAuditRecord[]>;
  countHallmarkAuditsByTenant(tenantId: TenantId): Promise<number>;

  saveReview(review: CustomerReview): Promise<void>;
  findReviewById(id: string, tenantId: TenantId): Promise<CustomerReview | null>;
  findReviewsBySeller(sellerProfileId: string, tenantId: TenantId): Promise<CustomerReview[]>;
}
