import type {
  TrustSafetyRepositoryPort,
  GuildLicense,
  HallmarkAuditRecord,
  CustomerReview,
  TenantId,
} from '@v-gold/core';

export class InMemoryTrustSafetyRepository implements TrustSafetyRepositoryPort {
  private licenses = new Map<string, GuildLicense>();
  private hallmarkAudits = new Map<string, HallmarkAuditRecord>();
  private reviews = new Map<string, CustomerReview>();

  async saveGuildLicense(license: GuildLicense): Promise<void> {
    this.licenses.set(license.id, license);
  }

  async findGuildLicenseById(id: string, tenantId: TenantId): Promise<GuildLicense | null> {
    const lic = this.licenses.get(id);
    if (!lic || lic.tenantId !== tenantId) return null;
    return lic;
  }

  async findGuildLicenseBySeller(sellerProfileId: string, tenantId: TenantId): Promise<GuildLicense | null> {
    const list = Array.from(this.licenses.values()).filter(
      (l) => l.tenantId === tenantId && l.sellerProfileId === sellerProfileId
    );
    return list.length > 0 ? list[0]! : null;
  }

  async saveHallmarkAudit(record: HallmarkAuditRecord): Promise<void> {
    this.hallmarkAudits.set(record.id, record);
  }

  async findHallmarkAuditsByTenant(tenantId: TenantId): Promise<HallmarkAuditRecord[]> {
    return Array.from(this.hallmarkAudits.values()).filter((h) => h.tenantId === tenantId);
  }

  async countHallmarkAuditsByTenant(tenantId: TenantId): Promise<number> {
    return Array.from(this.hallmarkAudits.values()).filter((h) => h.tenantId === tenantId).length;
  }

  async saveReview(review: CustomerReview): Promise<void> {
    this.reviews.set(review.id, review);
  }

  async findReviewById(id: string, tenantId: TenantId): Promise<CustomerReview | null> {
    const r = this.reviews.get(id);
    if (!r || r.tenantId !== tenantId) return null;
    return r;
  }

  async findReviewsBySeller(sellerProfileId: string, tenantId: TenantId): Promise<CustomerReview[]> {
    return Array.from(this.reviews.values()).filter(
      (r) => r.tenantId === tenantId && r.sellerProfileId === sellerProfileId
    );
  }

  clear(): void {
    this.licenses.clear();
    this.hallmarkAudits.clear();
    this.reviews.clear();
  }
}
