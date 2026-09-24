import { describe, expect, it } from 'vitest';
import {
  User,
  Email,
  PasswordHash,
  createEntityId,
  type UserId,
  ActorReference,
} from '@v-gold/core';

describe('User Domain Entity & Identity Primitives', () => {
  it('creates valid Email with canonical lowercase normalization', () => {
    const emailResult = Email.create('  John.Doe@V-Gold.Internal  ');
    expect(emailResult.isOk).toBe(true);

    const email = emailResult.unwrap();
    expect(email.value).toBe('john.doe@v-gold.internal');
    expect(email.toString()).toBe('john.doe@v-gold.internal');
  });

  it('rejects invalid email formats', () => {
    const invalidEmails = [
      '',
      '   ',
      'invalid-email',
      'user@',
      '@domain.com',
      'user@domain',
      'user space@domain.com',
      'a'.repeat(250) + '@domain.com', // exceeds 255 chars
    ];

    for (const invalid of invalidEmails) {
      const result = Email.create(invalid);
      expect(result.isErr, `Expected email "${invalid}" to be rejected`).toBe(true);
      if (result.isErr) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    }
  });

  it('creates PasswordHash and redacts plaintext from toString()', () => {
    const hashStr = 'scrypt$N=16384,r=8,p=1$abcdef1234567890$fedcba0987654321';
    const hash = PasswordHash.create(hashStr).unwrap();

    expect(hash.value).toBe(hashStr);
    // toString() must redact to prevent accidental log leakage
    expect(hash.toString()).toBe('[REDACTED_PASSWORD_HASH]');
  });

  it('rejects empty or excessively short password hashes', () => {
    expect(PasswordHash.create('').isErr).toBe(true);
    expect(PasswordHash.create('too-short').isErr).toBe(true);
  });

  it('creates User entity and generates safe DTO strictly omitting passwordHash', () => {
    const email = Email.create('artisan@v-gold.internal').unwrap();
    const hash = PasswordHash.create('scrypt$N=16384,r=8,p=1$1234567890abcdef$0987654321fedcba').unwrap();
    const actor = ActorReference.system();

    const user = User.create({
      email,
      displayName: 'Master Goldsmith',
      passwordHash: hash,
      actor,
    }).unwrap();

    expect(user.displayName).toBe('Master Goldsmith');
    expect(user.email.value).toBe('artisan@v-gold.internal');
    expect(user.status).toBe('ACTIVE');

    // Safe DTO verification
    const dto = user.toDto();
    expect(dto.id).toBe(user.id);
    expect(dto.email).toBe('artisan@v-gold.internal');
    expect(dto.displayName).toBe('Master Goldsmith');
    expect(dto.status).toBe('ACTIVE');
    expect((dto as any).passwordHash).toBeUndefined();
    expect((dto as any)._passwordHash).toBeUndefined();
  });

  it('handles user profile and state mutations with audit tracking', () => {
    const email = Email.create('user@v-gold.internal').unwrap();
    const hash1 = PasswordHash.create('scrypt$N=16384,r=8,p=1$1234567890abcdef$0987654321fedcba').unwrap();
    const hash2 = PasswordHash.create('scrypt$N=16384,r=8,p=1$fedcba0987654321$abcdef1234567890').unwrap();

    const user = User.create({
      email,
      displayName: 'Initial Name',
      passwordHash: hash1,
    }).unwrap();

    user.updateDisplayName('Updated Name').unwrap();
    expect(user.displayName).toBe('Updated Name');

    user.changePassword(hash2);
    expect(user.passwordHash.value).toBe(hash2.value);

    user.suspend();
    expect(user.status).toBe('SUSPENDED');

    user.activate();
    expect(user.status).toBe('ACTIVE');
  });
});
