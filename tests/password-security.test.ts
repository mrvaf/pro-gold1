import { describe, expect, it } from 'vitest';
import { ScryptPasswordHasher } from '@v-gold/database';

describe('Password Security & Hashing', () => {
  const hasher = new ScryptPasswordHasher();

  it('hashes plain password and successfully verifies matching credentials', async () => {
    const plainPassword = 'Strong#Password_2026';
    const hash = await hasher.hash(plainPassword);

    expect(hash).toMatch(/^scrypt\$N=16384,r=8,p=1\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
    expect(hash).not.toContain(plainPassword);

    // Matching password verification
    const isValid = await hasher.verify(plainPassword, hash);
    expect(isValid).toBe(true);

    // Mismatched password verification
    const isInvalid = await hasher.verify('WrongPassword123!', hash);
    expect(isInvalid).toBe(false);
  });

  it('enforces password policy (minimum 8 characters, maximum 128 characters)', async () => {
    // Under 8 characters
    await expect(hasher.hash('short7!')).rejects.toThrow('Password must be at least 8 characters long.');

    // Over 128 characters
    const hugePassword = 'a'.repeat(129);
    await expect(hasher.hash(hugePassword)).rejects.toThrow('Password cannot exceed 128 characters.');

    // Empty password
    await expect(hasher.hash('')).rejects.toThrow('Password must be a non-empty string.');
  });

  it('returns false gracefully on malformed or corrupted stored hashes', async () => {
    expect(await hasher.verify('password123', 'not-a-valid-hash')).toBe(false);
    expect(await hasher.verify('password123', '')).toBe(false);
    expect(await hasher.verify('password123', 'scrypt$corrupted$missing')).toBe(false);
  });

  it('generates unique salts for identical passwords', async () => {
    const password = 'IdenticalPassword123!';
    const hash1 = await hasher.hash(password);
    const hash2 = await hasher.hash(password);

    // Different salts mean different hashes
    expect(hash1).not.toBe(hash2);
    // Both verify correctly
    expect(await hasher.verify(password, hash1)).toBe(true);
    expect(await hasher.verify(password, hash2)).toBe(true);
  });
});
