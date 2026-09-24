import type { Tenant, TenantId } from '../domain/tenant/tenant.js';

export interface TenantRepositoryPort {
  findById(id: TenantId): Promise<Tenant | null>;
  findBySlug(slug: string): Promise<Tenant | null>;
  findAll(): Promise<readonly Tenant[]>;
  save(tenant: Tenant): Promise<void>;
  delete(id: TenantId): Promise<void>;
}
