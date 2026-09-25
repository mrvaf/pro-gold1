import { Entity } from '../../common/entity.js';
import { createEntityId, type EntityId } from '../../common/id.js';
import { generateId } from '../../common/id-generator.js';
import { ValidationError } from '../../common/errors.js';
import { ok, err, type Result } from '../../common/result.js';
import { AuditMetadata } from '../audit/audit-metadata.js';
import { ActorReference } from '../identity/actor-reference.js';
import type { TenantId } from '../tenant/tenant.js';
import type { DesignSessionId } from './design-session.js';
import {
  ExtractedDesignAttributes,
  type ExtractedDesignAttributesProps,
} from './extracted-design-attributes.js';
import { TokenAccounting, type TokenAccountingProps } from './token-accounting.js';
import { ConceptStateMachine, type DesignConceptStatus } from './concept-status.js';
import { ConceptGroundingViolationError, type InvalidConceptStateError } from './concept-errors.js';

export type DesignConceptId = EntityId<'DesignConcept'>;

export interface CreateDesignConceptProps {
  id?: string | undefined;
  sessionId: DesignSessionId;
  tenantId: TenantId;
  idempotencyKey: string;
  title: string;
  description: string;
  promptRefinement: string;
  visualPrompt: string;
  groundedAttributes: ExtractedDesignAttributes;
  tokenAccounting?: TokenAccounting | undefined;
  initialStatus?: DesignConceptStatus | undefined;
  actor?: ActorReference | undefined;
}

export interface DesignConceptDto {
  id: string;
  sessionId: string;
  tenantId: string;
  idempotencyKey: string;
  title: string;
  description: string;
  promptRefinement: string;
  visualPrompt: string;
  groundedAttributes: ExtractedDesignAttributesProps;
  tokenAccounting: TokenAccountingProps;
  status: DesignConceptStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * DesignConcept Aggregate Root.
 * Represents an AI-generated jewelry concept proposal grounded in verified domain attributes.
 *
 * Strict Invariants:
 * 1. AI cannot alter validated material specs (grounded attributes are strictly immutable).
 * 2. Idempotency key uniqueness per tenant/session.
 * 3. Token usage is accounted for across generation lifecycles.
 */
export class DesignConcept extends Entity<DesignConceptId> {
  private readonly _sessionId: DesignSessionId;
  private readonly _tenantId: TenantId;
  private readonly _idempotencyKey: string;
  private _title: string;
  private _description: string;
  private _promptRefinement: string;
  private _visualPrompt: string;
  private readonly _groundedAttributes: ExtractedDesignAttributes;
  private _tokenAccounting: TokenAccounting;
  private _status: DesignConceptStatus;
  private _audit: AuditMetadata;

  private constructor(
    id: DesignConceptId,
    sessionId: DesignSessionId,
    tenantId: TenantId,
    idempotencyKey: string,
    title: string,
    description: string,
    promptRefinement: string,
    visualPrompt: string,
    groundedAttributes: ExtractedDesignAttributes,
    tokenAccounting: TokenAccounting,
    status: DesignConceptStatus,
    audit: AuditMetadata
  ) {
    super(id);
    this._sessionId = sessionId;
    this._tenantId = tenantId;
    this._idempotencyKey = idempotencyKey;
    this._title = title;
    this._description = description;
    this._promptRefinement = promptRefinement;
    this._visualPrompt = visualPrompt;
    this._groundedAttributes = groundedAttributes;
    this._tokenAccounting = tokenAccounting;
    this._status = status;
    this._audit = audit;
  }

  get sessionId(): DesignSessionId {
    return this._sessionId;
  }

  get tenantId(): TenantId {
    return this._tenantId;
  }

  get idempotencyKey(): string {
    return this._idempotencyKey;
  }

  get title(): string {
    return this._title;
  }

  get description(): string {
    return this._description;
  }

  get promptRefinement(): string {
    return this._promptRefinement;
  }

  get visualPrompt(): string {
    return this._visualPrompt;
  }

  get groundedAttributes(): ExtractedDesignAttributes {
    return this._groundedAttributes;
  }

  get tokenAccounting(): TokenAccounting {
    return this._tokenAccounting;
  }

  get status(): DesignConceptStatus {
    return this._status;
  }

  get audit(): AuditMetadata {
    return this._audit;
  }

  static create(
    props: CreateDesignConceptProps
  ): Result<DesignConcept, ValidationError | ConceptGroundingViolationError> {
    if (!props.tenantId || props.tenantId.trim().length === 0) {
      return err(new ValidationError('DesignConcept must belong to a valid tenantId.'));
    }
    if (!props.sessionId || props.sessionId.trim().length === 0) {
      return err(new ValidationError('DesignConcept must reference a valid sessionId.'));
    }
    if (!props.idempotencyKey || props.idempotencyKey.trim().length === 0) {
      return err(new ValidationError('Idempotency key is required for concept generation.'));
    }
    if (!props.title || props.title.trim().length === 0) {
      return err(new ValidationError('Concept title cannot be empty.'));
    }

    // Strict Domain Grounding Check:
    // If metalType is GOLD, karat/purity or valid jewelryType cannot be tampered or contradictory
    const attrs = props.groundedAttributes;
    if (attrs.metalType === 'GOLD' && attrs.karatEquivalent) {
      const karatNum = parseInt(attrs.karatEquivalent, 10);
      if (isNaN(karatNum) || karatNum < 9 || karatNum > 24) {
        return err(
          new ConceptGroundingViolationError(
            `Invalid gold karat: "${attrs.karatEquivalent}". Valid range is 9 to 24 karats.`
          )
        );
      }
    }

    const id = createEntityId<DesignConceptId>(props.id ?? generateId('cpt'));
    const audit = AuditMetadata.create(props.actor ?? ActorReference.system());
    const tokenAccounting = props.tokenAccounting ?? TokenAccounting.zero();
    const status = props.initialStatus ?? 'GENERATED';

    return ok(
      new DesignConcept(
        id,
        props.sessionId,
        props.tenantId,
        props.idempotencyKey.trim(),
        props.title.trim(),
        props.description.trim(),
        props.promptRefinement.trim(),
        props.visualPrompt.trim(),
        props.groundedAttributes,
        tokenAccounting,
        status,
        audit
      )
    );
  }

  static reconstitute(
    id: DesignConceptId,
    sessionId: DesignSessionId,
    tenantId: TenantId,
    idempotencyKey: string,
    title: string,
    description: string,
    promptRefinement: string,
    visualPrompt: string,
    groundedAttributes: ExtractedDesignAttributes,
    tokenAccounting: TokenAccounting,
    status: DesignConceptStatus,
    audit: AuditMetadata
  ): DesignConcept {
    return new DesignConcept(
      id,
      sessionId,
      tenantId,
      idempotencyKey,
      title,
      description,
      promptRefinement,
      visualPrompt,
      groundedAttributes,
      tokenAccounting,
      status,
      audit
    );
  }

  approve(actor?: ActorReference): Result<void, InvalidConceptStateError> {
    const val = ConceptStateMachine.validateTransition(this._status, 'APPROVED');
    if (val.isErr) return err(val.error);

    this._status = 'APPROVED';
    this._audit = this._audit.touch(actor);
    return ok(undefined);
  }

  reject(actor?: ActorReference): Result<void, InvalidConceptStateError> {
    const val = ConceptStateMachine.validateTransition(this._status, 'REJECTED');
    if (val.isErr) return err(val.error);

    this._status = 'REJECTED';
    this._audit = this._audit.touch(actor);
    return ok(undefined);
  }

  toDto(): DesignConceptDto {
    return {
      id: this.id,
      sessionId: this._sessionId,
      tenantId: this._tenantId,
      idempotencyKey: this._idempotencyKey,
      title: this._title,
      description: this._description,
      promptRefinement: this._promptRefinement,
      visualPrompt: this._visualPrompt,
      groundedAttributes: this._groundedAttributes.toDto(),
      tokenAccounting: this._tokenAccounting.toDto(),
      status: this._status,
      createdAt: this._audit.createdAt.toISOString(),
      updatedAt: this._audit.updatedAt.toISOString(),
    };
  }
}
