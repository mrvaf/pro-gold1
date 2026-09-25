import { promisify } from 'node:util';
import crypto from 'node:crypto';
import type { PasswordHasherPort } from '@v-gold/core';
import { ValidationError } from '@v-gold/core';

const scryptAsync = promisify(crypto.scrypt);

export interface PasswordPolicy {
  minLength?: number;
  maxLength?: number;
}

export interface ScryptParams {
  N: number;
  r: number;
  p: number;
}

const DEFAULT_POLICY: Required<PasswordPolicy> = {
  minLength: 8,
  maxLength: 128,
};

/**
 * Stage 8.2 — ADR-0044: hardened scrypt parameters.
 * Defaults follow current OWASP guidance (N=2^17, r=8, p=1).
 */
export const DEFAULT_SCRYPT_PARAMS: Readonly<ScryptParams> = {
  N: 1 << 17, // 131072
  r: 8,
  p: 1,
};

/**
 * Safe configuration floor for NEWLY produced hashes. Legacy stored hashes
 * with weaker parameters (e.g. the old default N=2^14) still verify — `verify`
 * reads N/r/p from the hash itself — and are transparently upgraded on the
 * next successful login (PasswordHasherPort.needsRehash).
 */
export const MIN_SCRYPT_N = 1 << 14; // 16384
const MAX_SCRYPT_N = 1 << 22;
const MIN_SCRYPT_R = 8;
const MAX_SCRYPT_R = 32;
const MIN_SCRYPT_P = 1;
const MAX_SCRYPT_P = 16;

/** Verify-side bounds: accept any legacy hash our own hasher could have produced. */
const VERIFY_MIN_N = 1 << 10;
const VERIFY_MAX_N = MAX_SCRYPT_N;
const VERIFY_MAX_R = MAX_SCRYPT_R;
const VERIFY_MAX_P = MAX_SCRYPT_P;

const KEY_LENGTH_BYTES = 64;

function maxmemFor(N: number, r: number): number {
  // scrypt block-memory ≈ 128 * N * r bytes; provide 2x headroom plus slack.
  return 256 * N * r + 1024 * 1024;
}

function isPowerOfTwo(n: number): boolean {
  return Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;
}

function resolveParams(override?: Partial<ScryptParams>): ScryptParams {
  const envN = process.env.VGOLD_SCRYPT_N;
  const envR = process.env.VGOLD_SCRYPT_R;
  const envP = process.env.VGOLD_SCRYPT_P;

  const N = override?.N ?? (envN !== undefined ? Number(envN) : DEFAULT_SCRYPT_PARAMS.N);
  const r = override?.r ?? (envR !== undefined ? Number(envR) : DEFAULT_SCRYPT_PARAMS.r);
  const p = override?.p ?? (envP !== undefined ? Number(envP) : DEFAULT_SCRYPT_PARAMS.p);

  if (!isPowerOfTwo(N) || N < MIN_SCRYPT_N || N > MAX_SCRYPT_N) {
    throw new ValidationError(
      `scrypt N must be a power of two in [${MIN_SCRYPT_N}, ${MAX_SCRYPT_N}]. Received: ${String(N)}`
    );
  }
  if (!Number.isInteger(r) || r < MIN_SCRYPT_R || r > MAX_SCRYPT_R) {
    throw new ValidationError(
      `scrypt r must be an integer in [${MIN_SCRYPT_R}, ${MAX_SCRYPT_R}]. Received: ${String(r)}`
    );
  }
  if (!Number.isInteger(p) || p < MIN_SCRYPT_P || p > MAX_SCRYPT_P) {
    throw new ValidationError(
      `scrypt p must be an integer in [${MIN_SCRYPT_P}, ${MAX_SCRYPT_P}]. Received: ${String(p)}`
    );
  }

  return { N, r, p };
}

function parseStoredParams(storedHash: string): ScryptParams | null {
  const parts = storedHash.split('$');
  if (parts.length !== 4 || parts[0] !== 'scrypt') {
    return null;
  }
  const paramField = parts[1];
  if (!paramField) {
    return null;
  }
  const match = /^N=(\d+),r=(\d+),p=(\d+)$/.exec(paramField);
  if (!match) {
    return null;
  }
  const N = Number(match[1]);
  const r = Number(match[2]);
  const p = Number(match[3]);
  if (
    !isPowerOfTwo(N) ||
    N < VERIFY_MIN_N ||
    N > VERIFY_MAX_N ||
    !Number.isInteger(r) ||
    r < 1 ||
    r > VERIFY_MAX_R ||
    !Number.isInteger(p) ||
    p < 1 ||
    p > VERIFY_MAX_P
  ) {
    return null;
  }
  return { N, r, p };
}

/**
 * Scrypt Password Hasher.
 * Password hashing using Node.js native crypto.scrypt with OWASP-aligned
 * parameters (N=2^17, r=8, p=1), 16-byte CSPRNG salt and timing-safe
 * comparison. `verify` reads N/r/p from the stored hash so legacy hashes
 * remain valid across parameter upgrades.
 */
export class ScryptPasswordHasher implements PasswordHasherPort {
  private readonly minLength: number;
  private readonly maxLength: number;
  private readonly params: ScryptParams;

  constructor(policy: PasswordPolicy = {}, params?: Partial<ScryptParams>) {
    this.minLength = policy.minLength ?? DEFAULT_POLICY.minLength;
    this.maxLength = policy.maxLength ?? DEFAULT_POLICY.maxLength;
    this.params = resolveParams(params);
  }

  get currentParams(): Readonly<ScryptParams> {
    return this.params;
  }

  async hash(plainPassword: string): Promise<string> {
    this.validatePasswordPolicy(plainPassword);

    const { N, r, p } = this.params;
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = crypto.scryptSync(plainPassword, salt, KEY_LENGTH_BYTES, {
      N,
      r,
      p,
      maxmem: maxmemFor(N, r),
    });
    return `scrypt$N=${N},r=${r},p=${p}$${salt}$${derivedKey.toString('hex')}`;
  }

  async verify(plainPassword: string, storedHash: string): Promise<boolean> {
    if (!plainPassword || !storedHash) {
      return false;
    }

    const params = parseStoredParams(storedHash);
    const parts = storedHash.split('$');
    const salt = parts[2];
    const originalHashHex = parts[3];
    if (!params || !salt || !originalHashHex) {
      return false;
    }

    try {
      const originalBuffer = Buffer.from(originalHashHex, 'hex');
      const derivedKey = crypto.scryptSync(plainPassword, salt, originalBuffer.length, {
        N: params.N,
        r: params.r,
        p: params.p,
        maxmem: maxmemFor(params.N, params.r),
      });

      if (derivedKey.length !== originalBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(derivedKey, originalBuffer);
    } catch {
      return false;
    }
  }

  /**
   * True when the stored hash uses parameters weaker than the current
   * configuration (e.g. legacy N=2^14 hashes) and should be transparently
   * upgraded after the next successful login.
   */
  needsRehash(storedHash: string): boolean {
    const params = parseStoredParams(storedHash);
    if (!params) {
      return true;
    }
    return (
      params.N < this.params.N ||
      params.r < this.params.r ||
      params.p < this.params.p
    );
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
