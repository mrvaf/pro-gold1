import {
  SellerProfile,
  type SellerProfileId,
  type TenantId,
  type StoreId,
  type SellerProfileRepositoryPort,
  type SellerProfileFilter,
  type PublicSellerFilter,
} from '@v-gold/core';

export class InMemorySellerProfileRepository implements SellerProfileRepositoryPort {
  private readonly profiles = new Map<string, SellerProfile>();

  private clone(profile: SellerProfile): SellerProfile {
    return SellerProfile.reconstitute(
      profile.id,
      profile.tenantId,
      profile.storeId,
      profile.presence,
      profile.status,
      profile.businessRegistrationNumber,
      profile.taxId,
      profile.contactEmail,
      profile.contactPhone,
      profile.metadata ? JSON.parse(JSON.stringify(profile.metadata)) : undefined,
      profile.audit
    );
  }

  async save(seller: SellerProfile): Promise<void> {
    this.profiles.set(seller.id, this.clone(seller));
  }

  async findById(id: SellerProfileId, tenantId?: TenantId): Promise<SellerProfile | null> {
    const profile = this.profiles.get(id);
    if (!profile) return null;

    if (tenantId !== undefined && profile.tenantId !== tenantId) {
      return null;
    }

    return this.clone(profile);
  }

  async findBySlug(slug: string): Promise<SellerProfile | null> {
    const normalized = slug.trim().toLowerCase();
    for (const profile of this.profiles.values()) {
      if (profile.slug.toLowerCase() === normalized) {
        return this.clone(profile);
      }
    }
    return null;
  }

  async findByStoreId(storeId: StoreId, tenantId: TenantId): Promise<SellerProfile | null> {
    for (const profile of this.profiles.values()) {
      if (profile.tenantId === tenantId && profile.storeId === storeId) {
        return this.clone(profile);
      }
    }
    return null;
  }

  async listByTenant(tenantId: TenantId, filter?: SellerProfileFilter): Promise<SellerProfile[]> {
    let result = Array.from(this.profiles.values()).filter((p) => p.tenantId === tenantId);

    if (filter?.status) {
      result = result.filter((p) => p.status === filter.status);
    }

    if (filter?.storeId) {
      result = result.filter((p) => p.storeId === filter.storeId);
    }

    result.sort((a, b) => b.audit.createdAt.getTime() - a.audit.createdAt.getTime());

    if (filter?.offset !== undefined) {
      result = result.slice(filter.offset);
    }

    if (filter?.limit !== undefined) {
      result = result.slice(0, filter.limit);
    }

    return result.map((p) => this.clone(p));
  }

  async listPublicSellers(filter?: PublicSellerFilter): Promise<SellerProfile[]> {
    let result = Array.from(this.profiles.values()).filter(
      (p) => p.status === 'ACTIVE' && p.presence.isPubliclyVisible
    );

    result.sort((a, b) => a.displayName.localeCompare(b.displayName));

    if (filter?.offset !== undefined) {
      result = result.slice(filter.offset);
    }

    if (filter?.limit !== undefined) {
      result = result.slice(0, filter.limit);
    }

    return result.map((p) => this.clone(p));
  }

  async count(tenantId?: TenantId): Promise<number> {
    if (!tenantId) return this.profiles.size;
    return Array.from(this.profiles.values()).filter((p) => p.tenantId === tenantId).length;
  }

  clear(): void {
    this.profiles.clear();
  }
}
