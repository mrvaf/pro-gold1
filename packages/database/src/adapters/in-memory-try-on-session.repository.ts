import type {
  TryOnSession,
  TryOnSessionId,
  TryOnSessionRepositoryPort,
  TenantId,
  ProductId,
} from '@v-gold/core';

export class InMemoryTryOnSessionRepository implements TryOnSessionRepositoryPort {
  private readonly sessions = new Map<string, TryOnSession>();

  async save(session: TryOnSession): Promise<void> {
    this.sessions.set(session.id, session);
  }

  async findById(id: TryOnSessionId, tenantId?: TenantId): Promise<TryOnSession | null> {
    const session = this.sessions.get(id);
    if (!session) return null;
    if (tenantId && session.tenantId !== tenantId) return null;
    return session;
  }

  async listActiveByProduct(productId: ProductId, tenantId: TenantId): Promise<TryOnSession[]> {
    const now = new Date();
    return Array.from(this.sessions.values()).filter(
      (s) =>
        s.productId === productId &&
        s.tenantId === tenantId &&
        !s.isExpired(now) &&
        s.status === 'ACTIVE'
    );
  }

  async delete(id: TryOnSessionId, tenantId?: TenantId): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      if (tenantId && session.tenantId !== tenantId) return;
      this.sessions.delete(id);
    }
  }

  async count(tenantId?: TenantId): Promise<number> {
    if (!tenantId) return this.sessions.size;
    return Array.from(this.sessions.values()).filter((s) => s.tenantId === tenantId).length;
  }

  clear(): void {
    this.sessions.clear();
  }
}
