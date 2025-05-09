/**
 * @file Manages encryption and decryption for content at rest.
 */
import crypto from 'crypto';
import { EncryptedData } from '../../types/security-types';
// import { logger } from '../../../services/logger';
// import { ConfigManager } from '../../../services/config-manager'; // For retrieving master key

const KEY_LENGTH = 32; // For AES-256
const IV_LENGTH = 12; // For AES-GCM
const AUTH_TAG_LENGTH = 16; // For AES-GCM
const ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 16;
const KEY_DERIVATION_ITERATIONS = 100000; // PBKDF2 iterations

export class ContentCrypto {
  private masterKey: Buffer; // This key should be securely managed

  /**
   * Initializes the ContentCrypto service.
   * @param masterKeyOrPassword A master key (Buffer) or a password string to derive the key.
   *                            IMPORTANT: In a real application, the master key must be protected
   *                            and not hardcoded or easily guessable. Consider using system keychain
   *                            or a dedicated secret management service.
   * @param salt Optional salt if masterKeyOrPassword is a password. A new salt will be generated if not provided.
   *             The salt used for key derivation should be stored alongside the encrypted data if deriving from password.
   */
  constructor(masterKeyOrPassword: Buffer | string, salt?: Buffer) {
    if (Buffer.isBuffer(masterKeyOrPassword)) {
      if (masterKeyOrPassword.length !== KEY_LENGTH) {
        // logger.warn(`ContentCrypto: Provided master key length is ${masterKeyOrPassword.length}, expected ${KEY_LENGTH}. Hashing to fit.`);
        console.warn(`ContentCrypto: Provided master key length is ${masterKeyOrPassword.length}, expected ${KEY_LENGTH}. Hashing to fit.`);
        this.masterKey = crypto.createHash('sha256').update(masterKeyOrPassword).digest();
      } else {
        this.masterKey = masterKeyOrPassword;
      }
    } else { // It's a password string, derive the key
      const effectiveSalt = salt || crypto.randomBytes(SALT_LENGTH);
      if (!salt) {
        // logger.info('ContentCrypto: No salt provided for password, generating a new one. This salt must be stored to decrypt.');
        console.info('ContentCrypto: No salt provided for password, generating a new one. This salt must be stored to decrypt.');
        // In a real app, this generated salt would need to be stored (e.g., alongside the data or in a config)
        // For this example, we are deriving and using it, but not explicitly returning/storing it here.
        // The `encryptWithPassword` and `decryptWithPassword` methods would handle salt management.
      }
      this.masterKey = crypto.pbkdf2Sync(
        masterKeyOrPassword,
        effectiveSalt,
        KEY_DERIVATION_ITERATIONS,
        KEY_LENGTH,
        'sha512'
      );
    }
    // logger.info('ContentCrypto: Service initialized. Master key configured.');
    console.info('ContentCrypto: Service initialized. Master key configured.');
  }

  /**
   * Encrypts plaintext data using the configured master key.
   * @param plaintext The data to encrypt (string or Buffer).
   * @returns EncryptedData object.
   */
  encrypt(plaintext: string | Buffer): EncryptedData {
    try {
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ALGORITHM, this.masterKey, iv, {
        authTagLength: AUTH_TAG_LENGTH,
      });

      let encryptedChunks: Buffer[];
      if (Buffer.isBuffer(plaintext)) {
        encryptedChunks = [cipher.update(plaintext)];
      } else {
        encryptedChunks = [cipher.update(plaintext, 'utf8')];
      }
      encryptedChunks.push(cipher.final());
      const encrypted = Buffer.concat(encryptedChunks);
      const tag = cipher.getAuthTag();

      // logger.debug('ContentCrypto: Encryption successful.');
      console.debug('ContentCrypto: Encryption successful.');
      return {
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        ciphertext: encrypted.toString('base64'),
        algorithm: ALGORITHM,
      };
    } catch (error: any) {
      // logger.error('ContentCrypto: Encryption error.', error);
      console.error('ContentCrypto: Encryption error.', error);
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypts an EncryptedData object using the configured master key.
   * @param encryptedData The data to decrypt.
   * @returns The decrypted plaintext as a Buffer.
   */
  decrypt(encryptedData: EncryptedData): Buffer {
    if (encryptedData.algorithm !== ALGORITHM) {
      // logger.error(`ContentCrypto: Decryption failed. Algorithm mismatch. Expected ${ALGORITHM}, got ${encryptedData.algorithm}`);
      console.error(`ContentCrypto: Decryption failed. Algorithm mismatch. Expected ${ALGORITHM}, got ${encryptedData.algorithm}`);
      throw new Error(`Algorithm mismatch. Expected ${ALGORITHM}, got ${encryptedData.algorithm}`);
    }
    if (!encryptedData.tag) {
        // logger.error('ContentCrypto: Decryption failed. Authentication tag is missing for AES-GCM.');
        console.error('ContentCrypto: Decryption failed. Authentication tag is missing for AES-GCM.');
        throw new Error('Authentication tag is missing. AES-GCM requires a tag.');
    }

    try {
      const iv = Buffer.from(encryptedData.iv, 'base64');
      const tag = Buffer.from(encryptedData.tag, 'base64');
      const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64');

      const decipher = crypto.createDecipheriv(ALGORITHM, this.masterKey, iv, {
        authTagLength: AUTH_TAG_LENGTH,
      });
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(ciphertext);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      // logger.debug('ContentCrypto: Decryption successful.');
      console.debug('ContentCrypto: Decryption successful.');
      return decrypted;
    } catch (error: any) {
      // logger.error('ContentCrypto: Decryption error. Data may be tampered or key is incorrect.', error);
      console.error('ContentCrypto: Decryption error. Data may be tampered or key is incorrect.', error);
      throw new Error(`Decryption failed: ${error.message}. Possible data tampering or incorrect key.`);
    }
  }

  // Convenience methods for password-based encryption where salt is managed

  /**
   * Encrypts data using a password. The salt is generated and included in the output.
   * @param plaintext Data to encrypt.
   * @param password Password to derive encryption key.
   * @returns EncryptedData object, with salt prepended to IV (e.g., salt.iv) or in a separate field.
   *          For this example, we'll store salt within the IV field, base64(salt + iv).
   *          A better approach is a dedicated salt field in EncryptedData.
   */
  static encryptWithPassword(plaintext: string | Buffer, password: string): EncryptedData & { salt?: string } {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = crypto.pbkdf2Sync(password, salt, KEY_DERIVATION_ITERATIONS, KEY_LENGTH, 'sha512');
    
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

    let encryptedChunks: Buffer[];
    if (Buffer.isBuffer(plaintext)) {
      encryptedChunks = [cipher.update(plaintext)];
    } else {
      encryptedChunks = [cipher.update(plaintext, 'utf8')];
    }
    encryptedChunks.push(cipher.final());
    const encrypted = Buffer.concat(encryptedChunks);
    const tag = cipher.getAuthTag();

    return {
      iv: iv.toString('base64'), // Store IV and salt separately for clarity in real apps
      salt: salt.toString('base64'), // Add salt to the output
      tag: tag.toString('base64'),
      ciphertext: encrypted.toString('base64'),
      algorithm: ALGORITHM,
    };
  }

  /**
   * Decrypts data using a password and the salt from the encrypted data.
   * @param encryptedDataWithSalt EncryptedData object, must include the 'salt' field.
   * @param password Password to derive decryption key.
   * @returns Decrypted plaintext as Buffer.
   */
  static decryptWithPassword(encryptedDataWithSalt: EncryptedData & { salt?: string }, password: string): Buffer {
    if (!encryptedDataWithSalt.salt) {
      throw new Error('Salt is missing from encrypted data. Cannot decrypt with password.');
    }
    if (encryptedDataWithSalt.algorithm !== ALGORITHM) {
        throw new Error(`Algorithm mismatch. Expected ${ALGORITHM}, got ${encryptedDataWithSalt.algorithm}`);
    }
    if (!encryptedDataWithSalt.tag) {
        throw new Error('Authentication tag is missing. AES-GCM requires a tag.');
    }

    const salt = Buffer.from(encryptedDataWithSalt.salt, 'base64');
    const key = crypto.pbkdf2Sync(password, salt, KEY_DERIVATION_ITERATIONS, KEY_LENGTH, 'sha512');

    const iv = Buffer.from(encryptedDataWithSalt.iv, 'base64');
    const tag = Buffer.from(encryptedDataWithSalt.tag, 'base64');
    const ciphertext = Buffer.from(encryptedDataWithSalt.ciphertext, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted;
  }
}