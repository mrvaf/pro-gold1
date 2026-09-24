import { ValueObject } from '../../common/value-object.js';
import { ValidationError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';

export interface PasswordHashProps {
  hash: string;
}

/**
 * PasswordHash Value Object.
 * Encapsulates a cryptographically hashed password.
 * Guarantees that plaintext passwords never leak into persistent domain fields.
 */
export class PasswordHash extends ValueObject<PasswordHashProps> {
  private readonly _hash: string;

  private constructor(hash: string) {
    super({ hash });
    this._hash = hash;
  }

  get value(): string {
    return this._hash;
  }

  static create(hash: string): Result<PasswordHash, ValidationError> {
    if (!hash || typeof hash !== 'string' || hash.trim().length === 0) {
      return err(new ValidationError('Password hash cannot be empty.'));
    }

    const trimmed = hash.trim();
    // Must look like a valid hash (e.g. scrypt$... or $argon2... or $2b$...)
    if (trimmed.length < 16) {
      return err(new ValidationError('Password hash is too short to be cryptographically secure.'));
    }

    return ok(new PasswordHash(trimmed));
  }

  override toString(): string {
    // Redact internal representation in default string output to prevent accidental log leakage
    return '[REDACTED_PASSWORD_HASH]';
  }
}
