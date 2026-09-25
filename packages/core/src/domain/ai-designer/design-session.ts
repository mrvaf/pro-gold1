import { Entity } from '../../common/entity.js';
import { createEntityId, type EntityId } from '../../common/id.js';
import { generateId } from '../../common/id-generator.js';
import { ValidationError } from '../../common/errors.js';
import { ok, err, type Result } from '../../common/result.js';
import { AuditMetadata } from '../audit/audit-metadata.js';
import { ActorReference } from '../identity/actor-reference.js';
import type { TenantId } from '../tenant/tenant.js';
import type { UserId } from '../iam/user.js';
import { DesignSessionStateMachine, type DesignSessionStatus } from './design-session-status.js';
import { DesignMessage, type CreateDesignMessageInput, type DesignMessageProps } from './design-message.js';
import {
  ExtractedDesignAttributes,
  type ExtractedDesignAttributesProps,
} from './extracted-design-attributes.js';
import { InvalidDesignSessionStateError } from './ai-designer-errors.js';

export type DesignSessionId = EntityId<'DesignSession'>;

export interface CreateDesignSessionProps {
  id?: string | undefined;
  tenantId: TenantId;
  userId?: UserId | undefined;
  title?: string | undefined;
  initialMessage?: string | undefined;
  actor?: ActorReference | undefined;
}

export interface DesignSessionDto {
  id: string;
  tenantId: string;
  userId?: string | undefined;
  title: string;
  status: DesignSessionStatus;
  messages: DesignMessageProps[];
  extractedAttributes: ExtractedDesignAttributesProps;
  createdAt: string;
  updatedAt: string;
}

/**
 * DesignSession Aggregate Root.
 * Manages the state, conversation messages, and incremental extraction of
 * jewelry design attributes between a user and the AI Conversational Designer.
 */
export class DesignSession extends Entity<DesignSessionId> {
  private readonly _tenantId: TenantId;
  private readonly _userId: UserId | undefined;
  private _title: string;
  private _status: DesignSessionStatus;
  private _messages: DesignMessage[];
  private _extractedAttributes: ExtractedDesignAttributes;
  private _audit: AuditMetadata;

  private constructor(
    id: DesignSessionId,
    tenantId: TenantId,
    userId: UserId | undefined,
    title: string,
    status: DesignSessionStatus,
    messages: DesignMessage[],
    extractedAttributes: ExtractedDesignAttributes,
    audit: AuditMetadata
  ) {
    super(id);
    this._tenantId = tenantId;
    this._userId = userId;
    this._title = title;
    this._status = status;
    this._messages = messages;
    this._extractedAttributes = extractedAttributes;
    this._audit = audit;
  }

  get tenantId(): TenantId {
    return this._tenantId;
  }

  get userId(): UserId | undefined {
    return this._userId;
  }

  get title(): string {
    return this._title;
  }

  get status(): DesignSessionStatus {
    return this._status;
  }

  get messages(): readonly DesignMessage[] {
    return Object.freeze([...this._messages]);
  }

  get extractedAttributes(): ExtractedDesignAttributes {
    return this._extractedAttributes;
  }

  get audit(): AuditMetadata {
    return this._audit;
  }

  get isActive(): boolean {
    return this._status === 'ACTIVE';
  }

  static create(props: CreateDesignSessionProps): Result<DesignSession, ValidationError> {
    if (!props.tenantId || props.tenantId.trim().length === 0) {
      return err(new ValidationError('DesignSession must belong to a valid tenantId.'));
    }

    const id = createEntityId<DesignSessionId>(props.id ?? generateId('dsgn'));
    const audit = AuditMetadata.create(props.actor ?? ActorReference.system());
    const title = props.title?.trim() || 'New Jewelry Design';

    const messages: DesignMessage[] = [];
    if (props.initialMessage && props.initialMessage.trim().length > 0) {
      const msgRes = DesignMessage.create({
        role: 'USER',
        content: props.initialMessage,
      });
      if (msgRes.isErr) return err(msgRes.error);
      messages.push(msgRes.value);
    }

    return ok(
      new DesignSession(
        id,
        props.tenantId,
        props.userId,
        title,
        'ACTIVE',
        messages,
        ExtractedDesignAttributes.empty(),
        audit
      )
    );
  }

  static reconstitute(
    id: DesignSessionId,
    tenantId: TenantId,
    userId: UserId | undefined,
    title: string,
    status: DesignSessionStatus,
    messages: DesignMessage[],
    extractedAttributes: ExtractedDesignAttributes,
    audit: AuditMetadata
  ): DesignSession {
    return new DesignSession(
      id,
      tenantId,
      userId,
      title,
      status,
      [...messages],
      extractedAttributes,
      audit
    );
  }

  addMessage(
    input: CreateDesignMessageInput,
    actor?: ActorReference
  ): Result<DesignMessage, ValidationError | InvalidDesignSessionStateError> {
    if (this._status !== 'ACTIVE') {
      return err(
        new InvalidDesignSessionStateError(
          `Cannot add message to design session in status "${this._status}".`
        )
      );
    }

    const msgRes = DesignMessage.create(input);
    if (msgRes.isErr) return err(msgRes.error);

    this._messages.push(msgRes.value);
    this._audit = this._audit.touch(actor);
    return ok(msgRes.value);
  }

  updateExtractedAttributes(
    attributes: ExtractedDesignAttributes,
    actor?: ActorReference
  ): Result<void, InvalidDesignSessionStateError> {
    if (this._status !== 'ACTIVE') {
      return err(
        new InvalidDesignSessionStateError(
          `Cannot update attributes for design session in status "${this._status}".`
        )
      );
    }

    this._extractedAttributes = this._extractedAttributes.merge(attributes);
    this._audit = this._audit.touch(actor);
    return ok(undefined);
  }

  updateTitle(newTitle: string, actor?: ActorReference): Result<void, ValidationError> {
    if (!newTitle || newTitle.trim().length === 0) {
      return err(new ValidationError('Design session title cannot be empty.'));
    }
    if (newTitle.trim().length > 200) {
      return err(new ValidationError('Design session title cannot exceed 200 characters.'));
    }
    this._title = newTitle.trim();
    this._audit = this._audit.touch(actor);
    return ok(undefined);
  }

  complete(actor?: ActorReference): Result<void, InvalidDesignSessionStateError> {
    const val = DesignSessionStateMachine.validateTransition(this._status, 'COMPLETED');
    if (val.isErr) return err(val.error);

    this._status = 'COMPLETED';
    this._audit = this._audit.touch(actor);
    return ok(undefined);
  }

  abandon(actor?: ActorReference): Result<void, InvalidDesignSessionStateError> {
    const val = DesignSessionStateMachine.validateTransition(this._status, 'ABANDONED');
    if (val.isErr) return err(val.error);

    this._status = 'ABANDONED';
    this._audit = this._audit.touch(actor);
    return ok(undefined);
  }

  toDto(): DesignSessionDto {
    return {
      id: this.id,
      tenantId: this._tenantId,
      userId: this._userId,
      title: this._title,
      status: this._status,
      messages: this._messages.map((m) => m.toDto()),
      extractedAttributes: this._extractedAttributes.toDto(),
      createdAt: this._audit.createdAt.toISOString(),
      updatedAt: this._audit.updatedAt.toISOString(),
    };
  }
}
