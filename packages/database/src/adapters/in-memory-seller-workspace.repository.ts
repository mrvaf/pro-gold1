import {
  SellerWorkspace,
  type SellerWorkspaceId,
  type TenantId,
  type SellerProfileId,
  type SellerWorkspaceRepositoryPort,
  type SellerWorkspaceFilter,
} from '@v-gold/core';

export class InMemorySellerWorkspaceRepository implements SellerWorkspaceRepositoryPort {
  private readonly workspaces = new Map<string, SellerWorkspace>();

  private clone(workspace: SellerWorkspace): SellerWorkspace {
    return SellerWorkspace.reconstitute(
      workspace.id,
      workspace.tenantId,
      workspace.sellerProfileId,
      workspace.storeId,
      workspace.name,
      workspace.status,
      workspace.settings ? JSON.parse(JSON.stringify(workspace.settings)) : undefined,
      workspace.audit
    );
  }

  async save(workspace: SellerWorkspace): Promise<void> {
    this.workspaces.set(workspace.id, this.clone(workspace));
  }

  async findById(id: SellerWorkspaceId, tenantId?: TenantId): Promise<SellerWorkspace | null> {
    const ws = this.workspaces.get(id);
    if (!ws) return null;

    if (tenantId !== undefined && ws.tenantId !== tenantId) {
      return null;
    }

    return this.clone(ws);
  }

  async findBySellerProfileId(
    sellerProfileId: SellerProfileId,
    tenantId: TenantId
  ): Promise<SellerWorkspace | null> {
    for (const ws of this.workspaces.values()) {
      if (ws.tenantId === tenantId && ws.sellerProfileId === sellerProfileId) {
        return this.clone(ws);
      }
    }
    return null;
  }

  async listByTenant(
    tenantId: TenantId,
    filter?: SellerWorkspaceFilter
  ): Promise<SellerWorkspace[]> {
    let result = Array.from(this.workspaces.values()).filter((ws) => ws.tenantId === tenantId);

    if (filter?.status) {
      result = result.filter((ws) => ws.status === filter.status);
    }

    result.sort((a, b) => b.audit.createdAt.getTime() - a.audit.createdAt.getTime());

    if (filter?.offset !== undefined) {
      result = result.slice(filter.offset);
    }

    if (filter?.limit !== undefined) {
      result = result.slice(0, filter.limit);
    }

    return result.map((ws) => this.clone(ws));
  }

  async count(tenantId?: TenantId): Promise<number> {
    if (!tenantId) return this.workspaces.size;
    return Array.from(this.workspaces.values()).filter((ws) => ws.tenantId === tenantId).length;
  }

  clear(): void {
    this.workspaces.clear();
  }
}
