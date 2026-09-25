export interface PasswordHasherPort {
  hash(plainPassword: string): Promise<string>;
  verify(plainPassword: string, storedHash: string): Promise<boolean>;
  /**
   * Stage 8.2 (ADR-0044): returns true when the stored hash was produced with
   * parameters weaker than the current policy and should be transparently
   * upgraded (re-hashed) after the next successful authentication.
   * Optional for backward compatibility with custom implementations.
   */
  needsRehash?(storedHash: string): boolean;
}
