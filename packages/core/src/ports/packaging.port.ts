import { PackagingSpecification, type PackagingSpecId } from '../domain/packaging/packaging-specification.js';
import { type TenantId } from '../domain/tenant/tenant.js';

export interface PackagingRepositoryPort {
  save(spec: PackagingSpecification): Promise<void>;
  findById(id: PackagingSpecId, tenantId: TenantId): Promise<PackagingSpecification | null>;
  findByProductId(productId: string, tenantId: TenantId): Promise<PackagingSpecification[]>;
  findByTenantId(tenantId: TenantId): Promise<PackagingSpecification[]>;
  delete(id: PackagingSpecId, tenantId: TenantId): Promise<boolean>;
}
