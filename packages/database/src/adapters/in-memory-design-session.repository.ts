import {
  DesignSession,
  DesignMessage,
  ExtractedDesignAttributes,
  type DesignSessionId,
  type TenantId,
  type DesignSessionRepositoryPort,
} from '@v-gold/core';

export class InMemoryDesignSessionRepository implements DesignSessionRepositoryPort {
  private readonly sessions = new Map<string, DesignSession>();

  private clone(session: DesignSession): DesignSession {
    const rawMessages = session.messages.map((m) =>
      DesignMessage.create({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      }).unwrap()
    );

    const rawAttributes = ExtractedDesignAttributes.create(
      session.extractedAttributes.toDto()
    ).unwrap();

    return DesignSession.reconstitute(
      session.id,
      session.tenantId,
      session.userId,
      session.title,
      session.status,
      rawMessages,
      rawAttributes,
      session.audit
    );
  }

  async save(session: DesignSession): Promise<void> {
    this.sessions.set(session.id, this.clone(session));
  }

  async findById(id: DesignSessionId, tenantId?: TenantId): Promise<DesignSession | null> {
    const s = this.sessions.get(id);
    if (!s) return null;

    if (tenantId !== undefined && s.tenantId !== tenantId) {
      return null;
    }

    return this.clone(s);
  }

  async listByTenant(tenantId: TenantId, limit?: number): Promise<DesignSession[]> {
    let result = Array.from(this.sessions.values()).filter((s) => s.tenantId === tenantId);

    result.sort((a, b) => b.audit.updatedAt.getTime() - a.audit.updatedAt.getTime());

    if (limit !== undefined && limit > 0) {
      result = result.slice(0, limit);
    }

    return result.map((s) => this.clone(s));
  }

  async findByUser(tenantId: TenantId, userId: string): Promise<DesignSession[]> {
    const result = Array.from(this.sessions.values()).filter(
      (s) => s.tenantId === tenantId && s.userId === userId
    );

    result.sort((a, b) => b.audit.updatedAt.getTime() - a.audit.updatedAt.getTime());
    return result.map((s) => this.clone(s));
  }

  async delete(id: DesignSessionId, tenantId?: TenantId): Promise<void> {
    const session = this.sessions.get(id);
    if (!session) return;
    if (tenantId !== undefined && session.tenantId !== tenantId) return;
    this.sessions.delete(id);
  }

  async count(tenantId?: TenantId): Promise<number> {
    if (!tenantId) return this.sessions.size;
    return Array.from(this.sessions.values()).filter((s) => s.tenantId === tenantId).length;
  }

  clear(): void {
    this.sessions.clear();
  }
}
