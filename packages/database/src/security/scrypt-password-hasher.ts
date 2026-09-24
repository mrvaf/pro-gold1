import { promisify } from 'node:util';
import crypto from 'node:crypto';
import type { PasswordHasherPort } from '@v-gold/core';
import { ValidationError } from '@v-gold/core';

const scryptAsync = promisify(crypto.scrypt);

export interface PasswordPolicy {
  minLength?: number;
  maxLength?: number;
}

const DEFAULT_POLICY: Required<PasswordPolicy> = {
  minLength: 8,
  maxLength: 128,
};

/**
 * Scrypt Password Hasher.
 * Production-ready password hashing using Node.js native crypto.scrypt.
 * Uses 16-byte cryptographically random salt and timing-safe comparison to prevent timing attacks.
 */
export class ScryptPasswordHasher implements PasswordHasherPort {
  private readonly minLength: number;
  private readonly maxLength: number;

  constructor(policy: PasswordPolicy = {}) {
    this.minLength = policy.minLength ?? DEFAULT_POLICY.minLength;
    this.maxLength = policy.maxLength ?? DEFAULT_POLICY.maxLength;
  }

  async hash(plainPassword: string): Promise<string> {
    this.validatePasswordPolicy(plainPassword);

    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = (await scryptAsync(plainPassword, salt, 64)) as Buffer;
    return `scrypt$N=16384,r=8,p=1$${salt}$${derivedKey.toString('hex')}`;
  }

  async verify(plainPassword: string, storedHash: string): Promise<boolean> {
    if (!plainPassword || !storedHash) {
      return false;
    }

    const parts = storedHash.split('$');
    if (parts.length !== 4 || parts[0] !== 'scrypt') {
      return false;
    }

    const salt = parts[2];
    const originalHashHex = parts[3];
    if (!salt || !originalHashHex) {
      return false;
    }

    try {
      const originalBuffer = Buffer.from(originalHashHex, 'hex');
      const derivedKey = (await scryptAsync(plainPassword, salt, originalBuffer.length)) as Buffer;

      if (derivedKey.length !== originalBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(derivedKey, originalBuffer);
    } catch {
      return false;
    }
  }

  validatePasswordPolicy(plainPassword: string): void {
    if (!plainPassword || typeof plainPassword !== 'string') {
      throw new ValidationError('Password must be a non-empty string.');
    }
    if (plainPassword.length < this.minLength) {
      throw new ValidationError(`Password must be at least ${this.minLength} characters long.`);
    }
    if (plainPassword.length > this.maxLength) {
      throw new ValidationError(`Password cannot exceed ${this.maxLength} characters.`);
    }
  }
}
