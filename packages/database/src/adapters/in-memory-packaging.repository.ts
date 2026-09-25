import {
  type PackagingRepositoryPort,
  PackagingSpecification,
  BoxDimensions,
  Money,
  createEntityId,
  type PackagingSpecId,
  type TenantId,
  type ProductId,
} from '@v-gold/core';

export class InMemoryPackagingRepository implements PackagingRepositoryPort {
  private readonly items = new Map<string, PackagingSpecification>();

  private key(id: string, tenantId: string): string {
    return `${tenantId}:${id}`;
  }

  async save(spec: PackagingSpecification): Promise<void> {
    this.items.set(this.key(spec.id, spec.tenantId), spec);
  }

  async findById(id: PackagingSpecId, tenantId: TenantId): Promise<PackagingSpecification | null> {
    return this.items.get(this.key(id, tenantId)) ?? null;
  }

  async findByProductId(productId: string, tenantId: TenantId): Promise<PackagingSpecification[]> {
    const results: PackagingSpecification[] = [];
    for (const spec of this.items.values()) {
      if (spec.tenantId === tenantId && spec.productId === productId) {
        results.push(spec);
      }
    }
    return results;
  }

  async findByTenantId(tenantId: TenantId): Promise<PackagingSpecification[]> {
    const results: PackagingSpecification[] = [];
    for (const spec of this.items.values()) {
      if (spec.tenantId === tenantId) {
        results.push(spec);
      }
    }
    return results;
  }

  async delete(id: PackagingSpecId, tenantId: TenantId): Promise<boolean> {
    return this.items.delete(this.key(id, tenantId));
  }
}
