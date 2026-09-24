import { Entity } from '../../common/entity.js';
import { createEntityId, type EntityId } from '../../common/id.js';
import { ValidationError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';
import { AuditMetadata } from '../audit/audit-metadata.js';
import type { ActorReference } from '../identity/actor-reference.js';
import type { Email } from './email.js';
import type { PasswordHash } from './password-hash.js';

export type UserId = EntityId<'User'>;
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';

export interface CreateUserProps {
  id?: string;
  email: Email;
  displayName: string;
  passwordHash: PasswordHash;
  actor?: ActorReference;
}

export interface UserDto {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly status: UserStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * User Entity.
 * Represents an individual identity in the V-GOLD ecosystem.
 */
export class User extends Entity<UserId> {
  private readonly _email: Email;
  private _displayName: string;
  private _passwordHash: PasswordHash;
  private _status: UserStatus;
  private _audit: AuditMetadata;

  private constructor(
    id: UserId,
    email: Email,
    displayName: string,
    passwordHash: PasswordHash,
    status: UserStatus,
    audit: AuditMetadata
  ) {
    super(id);
    this._email = email;
    this._displayName = displayName;
    this._passwordHash = passwordHash;
    this._status = status;
    this._audit = audit;
  }

  get email(): Email {
    return this._email;
  }

  get displayName(): string {
    return this._displayName;
  }

  get passwordHash(): PasswordHash {
    return this._passwordHash;
  }

  get status(): UserStatus {
    return this._status;
  }

  get audit(): AuditMetadata {
    return this._audit;
  }

  static create(props: CreateUserProps): Result<User, ValidationError> {
    if (!props.displayName || props.displayName.trim().length === 0) {
      return err(new ValidationError('User display name cannot be empty.'));
    }

    const trimmedDisplayName = props.displayName.trim();
    if (trimmedDisplayName.length > 100) {
      return err(new ValidationError('User display name cannot exceed 100 characters.'));
    }

    const userId = createEntityId<UserId>(props.id ?? `user_${Math.random().toString(36).slice(2, 10)}`);
    const audit = AuditMetadata.create(props.actor);

    return ok(new User(userId, props.email, trimmedDisplayName, props.passwordHash, 'ACTIVE', audit));
  }

  static reconstitute(
    id: UserId,
    email: Email,
    displayName: string,
    passwordHash: PasswordHash,
    status: UserStatus,
    audit: AuditMetadata
  ): User {
    return new User(id, email, displayName, passwordHash, status, audit);
  }

  updateDisplayName(newName: string, actor?: ActorReference): Result<void, ValidationError> {
    if (!newName || newName.trim().length === 0) {
      return err(new ValidationError('User display name cannot be empty.'));
    }
    this._displayName = newName.trim();
    this._audit = this._audit.touch(actor);
    return ok(undefined);
  }

  changePassword(newHash: PasswordHash, actor?: ActorReference): void {
    this._passwordHash = newHash;
    this._audit = this._audit.touch(actor);
  }

  suspend(actor?: ActorReference): void {
    this._status = 'SUSPENDED';
    this._audit = this._audit.touch(actor);
  }

  activate(actor?: ActorReference): void {
    this._status = 'ACTIVE';
    this._audit = this._audit.touch(actor);
  }

  /**
   * Safe Data Transfer Object.
   * Strictly omits passwordHash to prevent credential leakage.
   */
  toDto(): UserDto {
    return {
      id: this.id,
      email: this._email.value,
      displayName: this._displayName,
      status: this._status,
      createdAt: this._audit.createdAt.toISOString(),
      updatedAt: this._audit.updatedAt.toISOString(),
    };
  }
}
