import type { UserId } from '../domain/iam/user.js';
import type { Session, SessionId } from '../domain/iam/session.js';

export interface SessionRepositoryPort {
  findById(id: SessionId): Promise<Session | null>;
  findAllByUserId(userId: UserId): Promise<readonly Session[]>;
  save(session: Session): Promise<void>;
  delete(id: SessionId): Promise<void>;
  deleteExpired(now?: Date): Promise<number>;
}
