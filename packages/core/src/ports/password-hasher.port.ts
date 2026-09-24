export interface PasswordHasherPort {
  hash(plainPassword: string): Promise<string>;
  verify(plainPassword: string, storedHash: string): Promise<boolean>;
}
