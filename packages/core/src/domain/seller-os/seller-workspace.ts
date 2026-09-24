import { Entity } from '../../common/entity.js';
import { createEntityId, type EntityId } from '../../common/id.js';
import { ValidationError } from '../../common/errors.js';
import { ok, err, type Result } from '../../common/result.js';
import { AuditMetadata } from '../audit/audit-metadata.js';
import { ActorReference } from '../identity/actor-reference.js';
import type { TenantId } from '../tenant/tenant.js';
import type { StoreId } from '../tenant/store.js';
import type { SellerProfileId } from '../marketplace/seller-profile.js';
import { WorkspaceStateMachine, type WorkspaceStatus } from './workspace-status.js';
import type { InvalidWorkspaceStateError } from './seller-os-errors.js';

export type SellerWorkspaceId = EntityId<'SellerWorkspace'>;

export interface CreateSellerWorkspaceProps {
  id?: string | undefined;
  tenantId: TenantId;
  sellerProfileId: SellerProfileId;
  storeId?: StoreId | undefined;
  name: string;
  initialStatus?: WorkspaceStatus | undefined;
  settings?: Record<string, unknown> | undefined;
  actor?: ActorReference | undefined;
}

export interface SellerWorkspaceDto {
  id: string;
  tenantId: string;
  sellerProfileId: string;
  storeId?: string | undefined;
  name: string;
  status: WorkspaceStatus;
  settings?: Record<string, unknown> | undefined;
  createdAt: string;
  updatedAt: string;
}

/**
 * SellerWorkspace Domain Entity.
 * Represents the internal merchant operational boundary linking Tenant, SellerProfile, and Store.
 * Enforces strict multi-tenant scoping and explicit lifecycle state transitions.
 */
export class SellerWorkspace extends Entity<SellerWorkspaceId> {
  private readonly _tenantId: TenantId;
  private readonly _sellerProfileId: SellerProfileId;
  private _storeId: StoreId | undefined;
  private _name: string;
  private _status: WorkspaceStatus;
  private _settings: Record<string, unknown> | undefined;
  private _audit: AuditMetadata;

  private constructor(
    id: SellerWorkspaceId,
    tenantId: TenantId,
    sellerProfileId: SellerProfileId,
    storeId: StoreId | undefined,
    name: string,
    status: WorkspaceStatus,
    settings: Record<string, unknown> | undefined,
    audit: AuditMetadata
  ) {
    super(id);
    this._tenantId = tenantId;
    this._sellerProfileId = sellerProfileId;
    this._storeId = storeId;
    this._name = name;
    this._status = status;
    this._settings = settings;
    this._audit = audit;
  }

  get tenantId(): TenantId {
    return this._tenantId;
  }

  get sellerProfileId(): SellerProfileId {
    return this._sellerProfileId;
  }

  get storeId(): StoreId | undefined {
    return this._storeId;
  }

  get name(): string {
    return this._name;
  }

  get status(): WorkspaceStatus {
    return this._status;
  }

  get settings(): Record<string, unknown> | undefined {
    return this._settings;
  }

  get audit(): AuditMetadata {
    return this._audit;
  }

  get isActive(): boolean {
    return this._status === 'ACTIVE';
  }

  static create(props: CreateSellerWorkspaceProps): Result<SellerWorkspace, ValidationError> {
    if (!props.tenantId || props.tenantId.trim().length === 0) {
      return err(new ValidationError('SellerWorkspace must belong to a valid tenantId.'));
    }
    if (!props.sellerProfileId || props.sellerProfileId.trim().length === 0) {
      return err(new ValidationError('SellerWorkspace must reference a valid sellerProfileId.'));
    }
    if (!props.name || props.name.trim().length < 2) {
      return err(new ValidationError('SellerWorkspace name must have at least 2 characters.'));
    }
    if (props.name.trim().length > 255) {
      return err(new ValidationError('SellerWorkspace name cannot exceed 255 characters.'));
    }

    const id = createEntityId<SellerWorkspaceId>(
      props.id ?? `ws_${props.sellerProfileId.replace(/^seller_/, '')}`
    );
    const audit = AuditMetadata.create(props.actor ?? ActorReference.system());
    const initialStatus = props.initialStatus ?? 'ACTIVE';

    return ok(
      new SellerWorkspace(
        id,
        props.tenantId,
        props.sellerProfileId,
        props.storeId,
        props.name.trim(),
        initialStatus,
        props.settings,
        audit
      )
    );
  }

  static reconstitute(
    id: SellerWorkspaceId,
    tenantId: TenantId,
    sellerProfileId: SellerProfileId,
    storeId: StoreId | undefined,
    name: string,
    status: WorkspaceStatus,
    settings: Record<string, unknown> | undefined,
    audit: AuditMetadata
  ): SellerWorkspace {
    return new SellerWorkspace(
      id,
      tenantId,
      sellerProfileId,
      storeId,
      name,
      status,
      settings,
      audit
    );
  }

  suspend(actor?: ActorReference, _reason?: string): Result<void, InvalidWorkspaceStateError> {
    const val = WorkspaceStateMachine.validateTransition(this._status, 'SUSPENDED');
    if (val.isErr) return err(val.error);

    this._status = 'SUSPENDED';
    this._audit = this._audit.touch(actor);
    return ok(undefined);
  }

  reinstate(actor?: ActorReference): Result<void, InvalidWorkspaceStateError> {
    const val = WorkspaceStateMachine.validateTransition(this._status, 'ACTIVE');
    if (val.isErr) return err(val.error);

    this._status = 'ACTIVE';
    this._audit = this._audit.touch(actor);
    return ok(undefined);
  }

  archive(actor?: ActorReference, _reason?: string): Result<void, InvalidWorkspaceStateError> {
    const val = WorkspaceStateMachine.validateTransition(this._status, 'ARCHIVED');
    if (val.isErr) return err(val.error);

    this._status = 'ARCHIVED';
    this._audit = this._audit.touch(actor);
    return ok(undefined);
  }

  updateName(newName: string, actor?: ActorReference): Result<void, ValidationError> {
    if (!newName || newName.trim().length < 2) {
      return err(new ValidationError('SellerWorkspace name must have at least 2 characters.'));
    }
    if (newName.trim().length > 255) {
      return err(new ValidationError('SellerWorkspace name cannot exceed 255 characters.'));
    }

    this._name = newName.trim();
    this._audit = this._audit.touch(actor);
    return ok(undefined);
  }

  updateSettings(settings: Record<string, unknown>, actor?: ActorReference): void {
    this._settings = { ...this._settings, ...settings };
    this._audit = this._audit.touch(actor);
  }

  setStoreId(storeId: StoreId | undefined, actor?: ActorReference): void {
    this._storeId = storeId;
    this._audit = this._audit.touch(actor);
  }

  toDto(): SellerWorkspaceDto {
    return {
      id: this.id,
      tenantId: this._tenantId,
      sellerProfileId: this._sellerProfileId,
      storeId: this._storeId,
      name: this._name,
      status: this._status,
      settings: this._settings,
      createdAt: this._audit.createdAt.toISOString(),
      updatedAt: this._audit.updatedAt.toISOString(),
    };
  }
}
