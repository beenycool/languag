/**
 * @file Manages encryption and decryption for communication channels.
 * Implements a basic cryptographic setup for secure IPC.
 */
import crypto from 'crypto';
import { EncryptedData } from '../../types/security-types';
// import { logger } from '../../../services/logger';

const KEY_LENGTH = 32; // For AES-256
const IV_LENGTH = 12; // For AES-GCM
const AUTH_TAG_LENGTH = 16; // For AES-GCM
const ALGORITHM = 'aes-256-gcm';

export class ChannelCrypto {
  private sharedSecret: Buffer | null = null;
  private localKeyPair: crypto.DiffieHellman;

  constructor() {
    // Generate Diffie-Hellman key pair for this side of the channel
    this.localKeyPair = crypto.createDiffieHellman(2048); // Or use a standard group like 'modp15'
    this.localKeyPair.generateKeys();
    // logger.info('ChannelCrypto: Local Diffie-Hellman key pair generated.');
    console.info('ChannelCrypto: Local Diffie-Hellman key pair generated.');
  }

  /**
   * Returns the local public key for key exchange.
   * @returns The public key as a base64 string.
   */
  getPublicKey(): string {
    return this.localKeyPair.getPublicKey('base64');
  }

  /**
   * Computes the shared secret using the remote party's public key.
   * This must be called before encryption/decryption can occur.
   * @param remotePublicKeyBase64 The remote party's public key (base64 encoded).
   * @throws Error if the remote public key is invalid.
   */
  computeSharedSecret(remotePublicKeyBase64: string): void {
    try {
      this.sharedSecret = this.localKeyPair.computeSecret(remotePublicKeyBase64, 'base64');
      // Ensure the secret is of the correct length for AES-256 by hashing if necessary
      if (this.sharedSecret.length !== KEY_LENGTH) {
        // logger.warn(`ChannelCrypto: DH secret length is ${this.sharedSecret.length}, expected ${KEY_LENGTH}. Hashing to fit.`);
        console.warn(`ChannelCrypto: DH secret length is ${this.sharedSecret.length}, expected ${KEY_LENGTH}. Hashing to fit.`);
        this.sharedSecret = crypto.createHash('sha256').update(this.sharedSecret).digest();
      }
      // logger.info('ChannelCrypto: Shared secret computed successfully.');
      console.info('ChannelCrypto: Shared secret computed successfully.');
    } catch (error: any) {
      // logger.error('ChannelCrypto: Failed to compute shared secret.', error);
      console.error('ChannelCrypto: Failed to compute shared secret.', error);
      this.sharedSecret = null; // Invalidate secret on error
      throw new Error(`Failed to compute shared secret: ${error.message}`);
    }
  }

  /**
   * Checks if a shared secret has been established.
   * @returns True if the shared secret is available.
   */
  isSecretEstablished(): boolean {
    return this.sharedSecret !== null;
  }

  /**
   * Encrypts a plaintext string or Buffer.
   * @param plaintext The data to encrypt.
   * @returns An EncryptedData object containing iv, tag, and ciphertext.
   * @throws Error if the shared secret is not established or encryption fails.
   */
  encrypt(plaintext: string | Buffer): EncryptedData {
    if (!this.sharedSecret) {
      // logger.error('ChannelCrypto: Encryption failed. Shared secret not established.');
      console.error('ChannelCrypto: Encryption failed. Shared secret not established.');
      throw new Error('Shared secret not established. Call computeSharedSecret first.');
    }

    try {
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ALGORITHM, this.sharedSecret, iv, {
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

      // logger.debug('ChannelCrypto: Encryption successful.');
      console.debug('ChannelCrypto: Encryption successful.');
      return {
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        ciphertext: encrypted.toString('base64'),
        algorithm: ALGORITHM,
      };
    } catch (error: any) {
      // logger.error('ChannelCrypto: Encryption error.', error);
      console.error('ChannelCrypto: Encryption error.', error);
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypts an EncryptedData object.
   * @param encryptedData The data to decrypt.
   * @returns The decrypted plaintext as a Buffer.
   * @throws Error if the shared secret is not established, decryption fails (e.g., bad tag), or data is malformed.
   */
  decrypt(encryptedData: EncryptedData): Buffer {
    if (!this.sharedSecret) {
      // logger.error('ChannelCrypto: Decryption failed. Shared secret not established.');
      console.error('ChannelCrypto: Decryption failed. Shared secret not established.');
      throw new Error('Shared secret not established. Call computeSharedSecret first.');
    }

    if (encryptedData.algorithm !== ALGORITHM) {
        // logger.error(`ChannelCrypto: Decryption failed. Algorithm mismatch. Expected ${ALGORITHM}, got ${encryptedData.algorithm}`);
        console.error(`ChannelCrypto: Decryption failed. Algorithm mismatch. Expected ${ALGORITHM}, got ${encryptedData.algorithm}`);
        throw new Error(`Algorithm mismatch. Expected ${ALGORITHM}, got ${encryptedData.algorithm}`);
    }
    if (!encryptedData.tag) {
        // logger.error('ChannelCrypto: Decryption failed. Authentication tag is missing for AES-GCM.');
        console.error('ChannelCrypto: Decryption failed. Authentication tag is missing for AES-GCM.');
        throw new Error('Authentication tag is missing. AES-GCM requires a tag.');
    }

    try {
      const iv = Buffer.from(encryptedData.iv, 'base64');
      const tag = Buffer.from(encryptedData.tag, 'base64');
      const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64');

      const decipher = crypto.createDecipheriv(ALGORITHM, this.sharedSecret, iv, {
        authTagLength: AUTH_TAG_LENGTH,
      });
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(ciphertext);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      // logger.debug('ChannelCrypto: Decryption successful.');
      console.debug('ChannelCrypto: Decryption successful.');
      return decrypted;
    } catch (error: any) {
      // logger.error('ChannelCrypto: Decryption error. Data may be tampered or key is incorrect.', error);
      console.error('ChannelCrypto: Decryption error. Data may be tampered or key is incorrect.', error);
      throw new Error(`Decryption failed: ${error.message}. Possible data tampering or incorrect key.`);
    }
  }

  /**
   * Resets the crypto state, clearing the shared secret.
   * A new key exchange would be required.
   */
  reset(): void {
    this.sharedSecret = null;
    this.localKeyPair = crypto.createDiffieHellman(2048); // Regenerate keys
    this.localKeyPair.generateKeys();
    // logger.info('ChannelCrypto: State reset. Shared secret cleared, new DH keys generated.');
    console.info('ChannelCrypto: State reset. Shared secret cleared, new DH keys generated.');
  }
}