import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { EncryptionError } from './social-commerce-errors.js';

/**
 * AES-256-GCM Secure Credential Encryptor.
 * Format of encrypted payload: iv:authTag:encryptedData (all hex-encoded).
 */
export class SecureCredentialVault {
  private readonly keyBuffer: Buffer;

  constructor(masterKeyHex?: string) {
    if (masterKeyHex) {
      if (masterKeyHex.length !== 64) {
        throw new EncryptionError('Master key must be exactly 64 hex characters (32 bytes).');
      }
      this.keyBuffer = Buffer.from(masterKeyHex, 'hex');
    } else {
      const defaultKeyHex =
        process.env.VGOLD_VAULT_MASTER_KEY ||
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      this.keyBuffer = Buffer.from(defaultKeyHex, 'hex');
    }
  }

  encrypt(plainText: string): string {
    if (!plainText) {
      throw new EncryptionError('Cannot encrypt empty or null text');
    }
    try {
      const iv = randomBytes(12); // Standard 96-bit IV for AES-GCM
      const cipher = createCipheriv('aes-256-gcm', this.keyBuffer, iv);
      let encrypted = cipher.update(plainText, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');
      return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (err: any) {
      throw new EncryptionError(`Encryption failed: ${err.message}`);
    }
  }

  decrypt(cipherPayload: string): string {
    if (!cipherPayload) {
      throw new EncryptionError('Cannot decrypt empty or null payload');
    }
    const parts = cipherPayload.split(':');
    if (parts.length !== 3) {
      throw new EncryptionError(
        'Invalid encrypted payload structure. Expected format: iv:authTag:encryptedData'
      );
    }
    const ivHex = parts[0]!;
    const authTagHex = parts[1]!;
    const encryptedHex = parts[2]!;

    try {
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = createDecipheriv('aes-256-gcm', this.keyBuffer, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err: any) {
      throw new EncryptionError(`Decryption failed or data integrity check failed: ${err.message}`);
    }
  }
}
