import { eq, lt } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  type SessionRepositoryPort,
  Session,
  createEntityId,
  type SessionId,
  type UserId,
} from '@v-gold/core';
import { sessionsTable, type SessionRecord } from '../schema/sessions.js';

export const toDomainSession = (record: SessionRecord): Session => {
  return Session.reconstitute(
    createEntityId<SessionId>(record.id),
    createEntityId<UserId>(record.userId),
    record.createdAt,
    record.expiresAt,
    record.revokedAt ?? undefined,
    record.lastActivityAt,
    record.userAgent ?? undefined,
    record.ipAddress ?? undefined
  );
};

export const toDatabaseSession = (session: Session): SessionRecord => {
  return {
    id: session.id,
    userId: session.userId,
    expiresAt: session.expiresAt,
    revokedAt: session.revokedAt ?? null,
    lastActivityAt: session.lastActivityAt,
    userAgent: session.userAgent ?? null,
    ipAddress: session.ipAddress ?? null,
    createdAt: session.createdAt,
  };
};

export class DrizzleSessionRepository implements SessionRepositoryPort {
  constructor(private readonly db: PgDatabase<any, any, any>) {}

  async findById(id: SessionId): Promise<Session | null> {
    const results = await this.db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, id))
      .limit(1);
    const record = results[0];
    return record ? toDomainSession(record) : null;
  }

  async findAllByUserId(userId: UserId): Promise<readonly Session[]> {
    const records = await this.db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.userId, userId));
    return records.map(toDomainSession);
  }

  async save(session: Session): Promise<void> {
    const record = toDatabaseSession(session);
    await this.db
      .insert(sessionsTable)
      .values(record)
      .onConflictDoUpdate({
        target: sessionsTable.id,
        set: {
          expiresAt: record.expiresAt,
          revokedAt: record.revokedAt,
          lastActivityAt: record.lastActivityAt,
        },
      });
  }

  async delete(id: SessionId): Promise<void> {
    await this.db.delete(sessionsTable).where(eq(sessionsTable.id, id));
  }

  async deleteExpired(now = new Date()): Promise<number> {
    const result = await this.db.delete(sessionsTable).where(lt(sessionsTable.expiresAt, now));
    return result.rowCount ?? 0;
  }
}
