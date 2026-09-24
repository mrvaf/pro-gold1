import { ValueObject } from '../../common/value-object.js';
import type { ActorReference } from '../identity/actor-reference.js';

export interface AuditMetadataProps {
  createdAt: string; // ISO 8601 string for serialization
  updatedAt: string;
  createdByActorId?: string | undefined;
  updatedByActorId?: string | undefined;
}

/**
 * Audit Metadata Value Object.
 * Preserves deterministic creation and modification timestamps and actor references.
 */
export class AuditMetadata extends ValueObject<AuditMetadataProps> {
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: ActorReference | undefined;
  readonly updatedBy: ActorReference | undefined;

  private constructor(
    createdAt: Date,
    updatedAt: Date,
    createdBy: ActorReference | undefined,
    updatedBy: ActorReference | undefined
  ) {
    super({
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
      ...(createdBy ? { createdByActorId: createdBy.actorId } : {}),
      ...(updatedBy ? { updatedByActorId: updatedBy.actorId } : {}),
    });
    this.createdAt = new Date(createdAt.getTime());
    this.updatedAt = new Date(updatedAt.getTime());
    this.createdBy = createdBy;
    this.updatedBy = updatedBy;
  }

  static create(actor?: ActorReference, timestamp = new Date()): AuditMetadata {
    return new AuditMetadata(timestamp, timestamp, actor, actor);
  }

  static fromDates(
    createdAt: Date,
    updatedAt: Date,
    createdBy?: ActorReference,
    updatedBy?: ActorReference
  ): AuditMetadata {
    return new AuditMetadata(createdAt, updatedAt, createdBy, updatedBy);
  }

  touch(actor?: ActorReference, timestamp = new Date()): AuditMetadata {
    return new AuditMetadata(this.createdAt, timestamp, this.createdBy, actor ?? this.updatedBy);
  }
}
