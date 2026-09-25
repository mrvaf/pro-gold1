import { ValueObject } from '../../common/value-object.js';
import { generateId } from '../../common/id-generator.js';
import { ValidationError } from '../../common/errors.js';
import { ok, err, type Result } from '../../common/result.js';

export type DesignMessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM';

export interface DesignMessageProps {
  id: string;
  role: DesignMessageRole;
  content: string;
  timestamp: string; // ISO 8601
}

export interface CreateDesignMessageInput {
  id?: string;
  role: DesignMessageRole;
  content: string;
  timestamp?: string | Date;
}

export class DesignMessage extends ValueObject<DesignMessageProps> {
  private constructor(props: DesignMessageProps) {
    super(props);
  }

  get id(): string {
    return this.props.id;
  }

  get role(): DesignMessageRole {
    return this.props.role;
  }

  get content(): string {
    return this.props.content;
  }

  get timestamp(): string {
    return this.props.timestamp;
  }

  static create(input: CreateDesignMessageInput): Result<DesignMessage, ValidationError> {
    const validRoles: DesignMessageRole[] = ['USER', 'ASSISTANT', 'SYSTEM'];
    if (!validRoles.includes(input.role)) {
      return err(
        new ValidationError(`Invalid message role: "${input.role}". Allowed roles: ${validRoles.join(', ')}`)
      );
    }

    if (!input.content || input.content.trim().length === 0) {
      return err(new ValidationError('Message content cannot be empty.'));
    }

    if (input.content.length > 8000) {
      return err(new ValidationError('Message content cannot exceed 8000 characters.'));
    }

    const id = input.id ?? generateId('msg');
    const timestamp =
      input.timestamp instanceof Date
        ? input.timestamp.toISOString()
        : typeof input.timestamp === 'string'
          ? input.timestamp
          : new Date().toISOString();

    return ok(
      new DesignMessage({
        id,
        role: input.role,
        content: input.content.trim(),
        timestamp,
      })
    );
  }

  toDto(): DesignMessageProps {
    return { ...this.props };
  }
}
