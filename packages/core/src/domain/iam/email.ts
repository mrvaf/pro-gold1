import { ValueObject } from '../../common/value-object.js';
import { ValidationError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';

export interface EmailProps {
  value: string;
}

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Email Value Object.
 * Enforces canonical lowercase normalization and strict structural validation.
 */
export class Email extends ValueObject<EmailProps> {
  private readonly _value: string;

  private constructor(value: string) {
    super({ value });
    this._value = value;
  }

  get value(): string {
    return this._value;
  }

  static create(rawEmail: string): Result<Email, ValidationError> {
    if (!rawEmail || typeof rawEmail !== 'string') {
      return err(new ValidationError('Email address must be a non-empty string.'));
    }

    const trimmed = rawEmail.trim();
    if (trimmed.length === 0) {
      return err(new ValidationError('Email address cannot be empty.'));
    }

    if (trimmed.length > 255) {
      return err(new ValidationError('Email address cannot exceed 255 characters.'));
    }

    const parts = trimmed.split('@');
    if (parts.length !== 2) {
      return err(new ValidationError('Email address must contain exactly one "@" symbol.'));
    }

    const [localPart, domainPart] = parts as [string, string];
    if (localPart.length === 0 || localPart.length > 64) {
      return err(new ValidationError('Email local part must be between 1 and 64 characters.'));
    }

    if (!domainPart || domainPart.length === 0) {
      return err(new ValidationError('Email domain part cannot be empty.'));
    }

    // Canonical normalization: lowercased
    const canonical = trimmed.toLowerCase();

    if (!EMAIL_REGEX.test(canonical)) {
      return err(new ValidationError(`Invalid email format: "${trimmed}".`));
    }

    return ok(new Email(canonical));
  }

  override toString(): string {
    return this._value;
  }
}
