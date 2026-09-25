import type { IdGeneratorPort } from '../ports/id-generator.port.js';

/**
 * Default IdGenerator implementation (Stage 8.2 — ADR-0043).
 *
 * Emits RFC 9562 (UUIDv7) identifiers:
 *   - 48-bit big-endian unix timestamp in milliseconds (time-ordering), and
 *   - 72 bits of entropy supplied exclusively by the platform CSPRNG
 *     (`globalThis.crypto.getRandomValues`) — never `Math.random()`.
 *
 * Lives in `common/` (outside the domain layer); domain factories consume it
 * through the `IdGeneratorPort` interface below.
 */

const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isUuidV7(value: string): boolean {
  return UUID_V7_PATTERN.test(value);
}

/**
 * Generates a raw UUIDv7 string. `nowMs` is injectable for deterministic tests;
 * the entropy source is always the CSPRNG.
 */
export function uuidv7(nowMs: number = Date.now()): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);

  const ts = BigInt(nowMs);
  bytes[0] = Number((ts >> 40n) & 0xffn);
  bytes[1] = Number((ts >> 32n) & 0xffn);
  bytes[2] = Number((ts >> 24n) & 0xffn);
  bytes[3] = Number((ts >> 16n) & 0xffn);
  bytes[4] = Number((ts >> 8n) & 0xffn);
  bytes[5] = Number(ts & 0xffn);

  // Version 7 (bits 48-51 of byte 6)
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  // Variant 10xx (bits 64-65 of byte 8)
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export class UuidV7IdGenerator implements IdGeneratorPort {
  generate(prefix?: string): string {
    const uuid = uuidv7();
    return prefix ? `${prefix}_${uuid}` : uuid;
  }
}

let defaultIdGenerator: IdGeneratorPort = new UuidV7IdGenerator();

export function getDefaultIdGenerator(): IdGeneratorPort {
  return defaultIdGenerator;
}

/** Replaces the process-wide default generator (tests / composition roots). */
export function setDefaultIdGenerator(generator: IdGeneratorPort): void {
  defaultIdGenerator = generator;
}

/** Convenience helper: default generator with an optional entity prefix. */
export function generateId(prefix?: string): string {
  return defaultIdGenerator.generate(prefix);
}
