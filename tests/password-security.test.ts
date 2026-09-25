import { describe, expect, it } from 'vitest';
import { ScryptPasswordHasher } from '@v-gold/database';

describe('Password Security & Hashing', () => {
  const hasher = new ScryptPasswordHasher();

  it('hashes plain password and successfully verifies matching credentials', async () => {
    const plainPassword = 'Strong#Password_2026';
    const hash = await hasher.hash(plainPassword);

    // Stage 8.2 (ADR-0044): default parameters are OWASP-aligned N=2^17, r=8, p=1.
    expect(hash).toMatch(/^scrypt\$N=131072,r=8,p=1\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
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

  it('verifies legacy hashes whose embedded parameters differ from the current defaults (N=2^14)', async () => {
    const legacyHasher = new ScryptPasswordHasher({}, { N: 16384, r: 8, p: 1 });
    const password = 'LegacyCompatible#2026';
    const legacyHash = await legacyHasher.hash(password);

    expect(legacyHash).toMatch(/^scrypt\$N=16384,r=8,p=1\$/);
    // Default (N=2^17) hasher must read N/r/p from the hash and still verify.
    expect(await hasher.verify(password, legacyHash)).toBe(true);
    expect(await hasher.verify('WrongLegacyPassword1', legacyHash)).toBe(false);
  });

  it('needsRehash reports weaker-than-current parameters (and unparseable hashes)', async () => {
    const legacyHasher = new ScryptPasswordHasher({}, { N: 16384, r: 8, p: 1 });
    const legacyHash = await legacyHasher.hash('RehashProbe#2026');
    const currentHash = await hasher.hash('RehashProbe#2026');

    expect(hasher.needsRehash(legacyHash)).toBe(true);
    expect(hasher.needsRehash(currentHash)).toBe(false);
    expect(legacyHasher.needsRehash(legacyHash)).toBe(false);
    expect(hasher.needsRehash('not-a-valid-hash')).toBe(true);
  });

  it('reads scrypt parameters from VGOLD_SCRYPT_* env with a safe floor (rejects weaker config)', async () => {
    const saved = {
      N: process.env.VGOLD_SCRYPT_N,
      r: process.env.VGOLD_SCRYPT_R,
      p: process.env.VGOLD_SCRYPT_P,
    };
    try {
      // Below the safe floor (2^14): construction must fail loudly.
      process.env.VGOLD_SCRYPT_N = '1024';
      expect(() => new ScryptPasswordHasher()).toThrow(/scrypt N must be a power of two/);

      // Non power-of-two is rejected as well.
      process.env.VGOLD_SCRYPT_N = '20000';
      expect(() => new ScryptPasswordHasher()).toThrow(/scrypt N must be a power of two/);

      // Floor-level configuration is accepted and used for NEW hashes.
      process.env.VGOLD_SCRYPT_N = '16384';
      const floorHasher = new ScryptPasswordHasher();
      const floorHash = await floorHasher.hash('EnvConfigured#2026');
      expect(floorHash).toMatch(/^scrypt\$N=16384,r=8,p=1\$/);
      // ...and is flagged for upgrade relative to the hardened default.
      expect(hasher.needsRehash(floorHash)).toBe(true);
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        const envKey = `VGOLD_SCRYPT_${key}`;
        if (value === undefined) {
          delete process.env[envKey];
        } else {
          process.env[envKey] = value;
        }
      }
    }
  });
});
