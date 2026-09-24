import { Entity } from '../../common/entity.js';
import { createEntityId, type EntityId } from '../../common/id.js';
import { ValidationError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';
import { AuditMetadata } from '../audit/audit-metadata.js';
import type { ActorReference } from '../identity/actor-reference.js';

export type TenantId = EntityId<'Tenant'>;
export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';

export interface CreateTenantProps {
  id?: string;
  name: string;
  slug: string;
  actor?: ActorReference;
}

/**
 * Tenant Entity.
 * Top-level organizational isolation boundary in V-GOLD.
 */
export class Tenant extends Entity<TenantId> {
  private _name: string;
  private _slug: string;
  private _status: TenantStatus;
  private _audit: AuditMetadata;

  private constructor(
    id: TenantId,
    name: string,
    slug: string,
    status: TenantStatus,
    audit: AuditMetadata
  ) {
    super(id);
    this._name = name;
    this._slug = slug;
    this._status = status;
    this._audit = audit;
  }

  get name(): string {
    return this._name;
  }

  get slug(): string {
    return this._slug;
  }

  get status(): TenantStatus {
    return this._status;
  }

  get audit(): AuditMetadata {
    return this._audit;
  }

  static create(props: CreateTenantProps): Result<Tenant, ValidationError> {
    if (!props.name || props.name.trim().length === 0) {
      return err(new ValidationError('Tenant name cannot be empty.'));
    }
    const trimmedName = props.name.trim();

    if (!props.slug || props.slug.trim().length === 0) {
      return err(new ValidationError('Tenant slug cannot be empty.'));
    }
    const normalizedSlug = props.slug.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(normalizedSlug)) {
      return err(
        new ValidationError(`Invalid tenant slug: "${props.slug}". Slug must contain only lowercase alphanumeric characters and hyphens.`)
      );
    }

    const tenantId = createEntityId<TenantId>(props.id ?? `tenant_${normalizedSlug}`);
    const audit = AuditMetadata.create(props.actor);

    return ok(new Tenant(tenantId, trimmedName, normalizedSlug, 'ACTIVE', audit));
  }

  static reconstitute(
    id: TenantId,
    name: string,
    slug: string,
    status: TenantStatus,
    audit: AuditMetadata
  ): Tenant {
    return new Tenant(id, name, slug, status, audit);
  }

  updateName(newName: string, actor?: ActorReference): Result<void, ValidationError> {
    if (!newName || newName.trim().length === 0) {
      return err(new ValidationError('Tenant name cannot be empty.'));
    }
    this._name = newName.trim();
    this._audit = this._audit.touch(actor);
    return ok(undefined);
  }

  suspend(actor?: ActorReference): void {
    this._status = 'SUSPENDED';
    this._audit = this._audit.touch(actor);
  }

  activate(actor?: ActorReference): void {
    this._status = 'ACTIVE';
    this._audit = this._audit.touch(actor);
  }
}
