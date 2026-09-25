/**
 * IdGenerator Port (Stage 8.2 — ADR-0043).
 *
 * Single source of entity identifier generation, deliberately kept OUTSIDE the
 * domain layer: domain factories delegate to this port and never assemble ids
 * from `Math.random()` / `Date.now()` themselves. The default implementation
 * (`UuidV7IdGenerator`) produces RFC 9562 UUIDv7 values whose entropy comes
 * exclusively from a CSPRNG.
 */
export interface IdGeneratorPort {
  /**
   * Generates a new opaque entity identifier.
   *
   * @param prefix Optional entity-type prefix (e.g. "prod", "user") kept for
   *               debuggability; the generated part is always a UUIDv7.
   */
  generate(prefix?: string): string;
}
