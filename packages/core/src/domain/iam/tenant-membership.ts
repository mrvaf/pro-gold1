import { Entity } from '../../common/entity.js';
import { createEntityId, type EntityId } from '../../common/id.js';
import { generateId } from '../../common/id-generator.js';
import { ValidationError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';
import { AuditMetadata } from '../audit/audit-metadata.js';
import type { ActorReference } from '../identity/actor-reference.js';
import type { TenantId } from '../tenant/tenant.js';
import type { UserId } from './user.js';
import { type Role, type Permission, hasPermission } from './permissions.js';

export type MembershipId = EntityId<'Membership'>;
export type MembershipStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

export interface CreateMembershipProps {
  id?: string;
  tenantId: TenantId;
  userId: UserId;
  role: Role;
  actor?: ActorReference;
}

/**
 * TenantMembership Entity.
 * Represents an explicit, auditable association between a User and a Tenant with a specific Role.
 */
export class TenantMembership extends Entity<MembershipId> {
  private readonly _tenantId: TenantId;
  private readonly _userId: UserId;
  private _role: Role;
  private _status: MembershipStatus;
  private _audit: AuditMetadata;

  private constructor(
    id: MembershipId,
    tenantId: TenantId,
    userId: UserId,
    role: Role,
    status: MembershipStatus,
    audit: AuditMetadata
  ) {
    super(id);
    this._tenantId = tenantId;
    this._userId = userId;
    this._role = role;
    this._status = status;
    this._audit = audit;
  }

  get tenantId(): TenantId {
    return this._tenantId;
  }

  get userId(): UserId {
    return this._userId;
  }

  get role(): Role {
    return this._role;
  }

  get status(): MembershipStatus {
    return this._status;
  }

  get audit(): AuditMetadata {
    return this._audit;
  }

  static create(props: CreateMembershipProps): Result<TenantMembership, ValidationError> {
    if (!props.tenantId || props.tenantId.trim().length === 0) {
      return err(new ValidationError('TenantId cannot be empty.'));
    }
    if (!props.userId || props.userId.trim().length === 0) {
      return err(new ValidationError('UserId cannot be empty.'));
    }

    const membershipId = createEntityId<MembershipId>(
      props.id ?? generateId('mem')
    );
    const audit = AuditMetadata.create(props.actor);

    return ok(new TenantMembership(membershipId, props.tenantId, props.userId, props.role, 'ACTIVE', audit));
  }

  static reconstitute(
    id: MembershipId,
    tenantId: TenantId,
    userId: UserId,
    role: Role,
    status: MembershipStatus,
    audit: AuditMetadata
  ): TenantMembership {
    return new TenantMembership(id, tenantId, userId, role, status, audit);
  }

  changeRole(newRole: Role, actor?: ActorReference): void {
    this._role = newRole;
    this._audit = this._audit.touch(actor);
  }

  suspend(actor?: ActorReference): void {
    this._status = 'SUSPENDED';
    this._audit = this._audit.touch(actor);
  }

  revoke(actor?: ActorReference): void {
    this._status = 'REVOKED';
    this._audit = this._audit.touch(actor);
  }

  activate(actor?: ActorReference): void {
    this._status = 'ACTIVE';
    this._audit = this._audit.touch(actor);
  }

  isActive(): boolean {
    return this._status === 'ACTIVE';
  }

  can(permission: Permission): boolean {
    if (!this.isActive()) {
      return false;
    }
    return hasPermission(this._role, permission);
  }
}
