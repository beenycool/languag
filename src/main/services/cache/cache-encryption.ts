import * as crypto from 'crypto';
import * as winston from 'winston';
import { LLMCacheConfig } from '../../../shared/types/config'; // Corrected path

const DEFAULT_ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const DEFAULT_IV_LENGTH = 12; // bytes for GCM
const DEFAULT_AUTH_TAG_LENGTH = 16; // bytes for GCM

export class CacheEncryption {
  private readonly config: LLMCacheConfig['encryption'];
  private readonly logger: winston.Logger;
  private readonly isEnabled: boolean;
  private derivedKey: Buffer | null = null;

  constructor(config: LLMCacheConfig['encryption'] | undefined, logger: winston.Logger) {
    this.config = config;
    this.logger = logger.child({ module: 'CacheEncryption' });
    this.isEnabled = !!(config?.enabled && config.key);

    if (config?.enabled && !config.key) {
      this.logger.error('Cache encryption is enabled but no key is provided. Encryption will be disabled.');
      this.isEnabled = false;
    } else if (this.isEnabled) {
      this.derivedKey = this.getEncryptionKey();
      this.logger.info('Cache encryption enabled.');
      // Production systems should validate key length/format here based on the algorithm.
    }
  }

  public getIsEnabled(): boolean {
    return this.isEnabled;
  }

  private getEncryptionKey(): Buffer {
    // In a real app, derive a fixed-length key from the config key, e.g., using SHA-256
    // For AES-256, the key must be 32 bytes.
    const keyString = this.config?.key || "default-fallback-key-should-not-happen"; // Should not happen due to isEnabled check
    return crypto.createHash('sha256').update(String(keyString)).digest();
  }

  public encrypt(data: any): string | null {
    if (!this.isEnabled || !this.derivedKey || data === undefined || data === null) {
        // If not enabled or data is null/undefined, return stringified JSON
        try {
            return JSON.stringify(data);
        } catch (e) {
            this.logger.error('Failed to stringify data for non-encrypted storage.', { error: e });
            return null; // Cannot even stringify
        }
    }

    try {
      const text = JSON.stringify(data);
      const iv = crypto.randomBytes(this.config?.ivLength || DEFAULT_IV_LENGTH);
      const algorithm = this.config?.algorithm || DEFAULT_ENCRYPTION_ALGORITHM;
      const key = this.derivedKey;

      const cipher = crypto.createCipheriv(algorithm, key, iv) as crypto.CipherGCM;
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();

      // Prepend IV and AuthTag to the encrypted data for decryption
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error: any) {
      this.logger.error(`Encryption failed: ${error.message}. Returning null.`, { error });
      return null; // Indicate encryption failure
    }
  }

  public decrypt<T>(encryptedData: string): T | undefined {
    if (!this.isEnabled || !this.derivedKey || !encryptedData) {
        // If not enabled or no data, assume it's JSON and try to parse
        try {
            return JSON.parse(encryptedData) as T;
        } catch (e) {
            this.logger.warn('Failed to parse non-encrypted data as JSON.', { error: e });
            return undefined;
        }
    }

    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        this.logger.error('Encrypted data format is invalid (expected iv:authTag:data). Cannot decrypt.');
        // Do NOT fall back to JSON parse here, as it's supposed to be encrypted.
        return undefined;
      }
      const [ivHex, authTagHex, encryptedText] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const algorithm = this.config?.algorithm || DEFAULT_ENCRYPTION_ALGORITHM;
      const key = this.derivedKey;

      // Validate IV and AuthTag lengths if necessary (GCM defaults are usually fine)
      if (iv.length !== (this.config?.ivLength || DEFAULT_IV_LENGTH)) {
          this.logger.error(`Decryption failed: Invalid IV length. Expected ${this.config?.ivLength || DEFAULT_IV_LENGTH}, got ${iv.length}`);
          return undefined;
      }
       // GCM auth tag length is standard, less critical to check explicitly unless deviating

      const decipher = crypto.createDecipheriv(algorithm, key, iv) as crypto.DecipherGCM;
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted) as T;
    } catch (error: any) {
      // Common errors: 'Unsupported state' or 'Unknown cipher' (bad key/tag/iv)
      this.logger.error(`Decryption failed: ${error.message}. Returning undefined.`, { error });
      return undefined; // Return undefined on failure
    }
  }
}