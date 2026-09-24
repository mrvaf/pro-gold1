import { ValueObject } from '../../common/value-object.js';
import { ValidationError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';

export type ActorType = 'USER' | 'SYSTEM' | 'EXTERNAL';

export interface ActorReferenceProps {
  actorId: string;
  actorType: ActorType;
}

/**
 * Foundational Actor Reference.
 * Tracks identity of the mutating agent (User, System worker, or External webhook)
 * without coupling the domain to concrete authentication/IAM schemas.
 */
export class ActorReference extends ValueObject<ActorReferenceProps> {
  private constructor(props: ActorReferenceProps) {
    super(props);
  }

  get actorId(): string {
    return this.props.actorId;
  }

  get actorType(): ActorType {
    return this.props.actorType;
  }

  static create(actorId: string, actorType: ActorType): Result<ActorReference, ValidationError> {
    if (!actorId || actorId.trim().length === 0) {
      return err(new ValidationError('Actor ID cannot be empty.'));
    }
    return ok(new ActorReference({ actorId: actorId.trim(), actorType }));
  }

  static system(systemIdentifier = 'SYSTEM'): ActorReference {
    return new ActorReference({ actorId: systemIdentifier, actorType: 'SYSTEM' });
  }

  static user(userId: string): Result<ActorReference, ValidationError> {
    return ActorReference.create(userId, 'USER');
  }
}
