import type { SessionRepositoryPort, Session, SessionId, UserId } from '@v-gold/core';
import { InMemoryRepository } from '../in-memory-store.js';

export class InMemorySessionRepository
  extends InMemoryRepository<Session, SessionId>
  implements SessionRepositoryPort
{
  async findAllByUserId(userId: UserId): Promise<readonly Session[]> {
    const results: Session[] = [];
    for (const session of this.items.values()) {
      if (session.userId === userId) {
        results.push(session);
      }
    }
    return results;
  }

  async deleteExpired(now = new Date()): Promise<number> {
    let count = 0;
    for (const [id, session] of this.items.entries()) {
      if (session.isExpired(now)) {
        this.items.delete(id);
        count++;
      }
    }
    return count;
  }
}
