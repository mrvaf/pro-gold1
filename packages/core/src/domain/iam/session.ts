import { Entity } from '../../common/entity.js';
import { createEntityId, type EntityId } from '../../common/id.js';
import { ValidationError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';
import type { UserId } from './user.js';

export type SessionId = EntityId<'Session'>;

export interface CreateSessionProps {
  id: string; // Cryptographically random token/id
  userId: UserId;
  ttlMs?: number; // Default 7 days
  userAgent?: string;
  ipAddress?: string;
}

export const DEFAULT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Session Entity.
 * Server-side authenticated session tracking.
 */
export class Session extends Entity<SessionId> {
  private readonly _userId: UserId;
  private readonly _createdAt: Date;
  private readonly _expiresAt: Date;
  private _revokedAt: Date | undefined;
  private _lastActivityAt: Date;
  private readonly _userAgent: string | undefined;
  private readonly _ipAddress: string | undefined;

  private constructor(
    id: SessionId,
    userId: UserId,
    createdAt: Date,
    expiresAt: Date,
    revokedAt: Date | undefined,
    lastActivityAt: Date,
    userAgent?: string,
    ipAddress?: string
  ) {
    super(id);
    this._userId = userId;
    this._createdAt = createdAt;
    this._expiresAt = expiresAt;
    this._revokedAt = revokedAt;
    this._lastActivityAt = lastActivityAt;
    this._userAgent = userAgent;
    this._ipAddress = ipAddress;
  }

  get userId(): UserId {
    return this._userId;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get expiresAt(): Date {
    return this._expiresAt;
  }

  get revokedAt(): Date | undefined {
    return this._revokedAt;
  }

  get lastActivityAt(): Date {
    return this._lastActivityAt;
  }

  get userAgent(): string | undefined {
    return this._userAgent;
  }

  get ipAddress(): string | undefined {
    return this._ipAddress;
  }

  static create(props: CreateSessionProps): Result<Session, ValidationError> {
    if (!props.id || props.id.trim().length < 32) {
      return err(new ValidationError('Session ID must be a cryptographically random string of at least 32 characters.'));
    }
    if (!props.userId || props.userId.trim().length === 0) {
      return err(new ValidationError('Session must be linked to a valid UserId.'));
    }

    const now = new Date();
    const ttl = props.ttlMs ?? DEFAULT_SESSION_TTL_MS;
    const expiresAt = new Date(now.getTime() + ttl);
    const sessionId = createEntityId<SessionId>(props.id.trim());

    return ok(
      new Session(
        sessionId,
        props.userId,
        now,
        expiresAt,
        undefined,
        now,
        props.userAgent?.trim(),
        props.ipAddress?.trim()
      )
    );
  }

  static reconstitute(
    id: SessionId,
    userId: UserId,
    createdAt: Date,
    expiresAt: Date,
    revokedAt: Date | undefined,
    lastActivityAt: Date,
    userAgent?: string,
    ipAddress?: string
  ): Session {
    return new Session(
      id,
      userId,
      createdAt,
      expiresAt,
      revokedAt,
      lastActivityAt,
      userAgent,
      ipAddress
    );
  }

  isExpired(now = new Date()): boolean {
    return now.getTime() >= this._expiresAt.getTime();
  }

  isRevoked(): boolean {
    return this._revokedAt !== undefined;
  }

  isValid(now = new Date()): boolean {
    return !this.isRevoked() && !this.isExpired(now);
  }

  revoke(now = new Date()): void {
    if (!this._revokedAt) {
      this._revokedAt = now;
    }
  }

  recordActivity(now = new Date()): void {
    this._lastActivityAt = now;
  }
}
