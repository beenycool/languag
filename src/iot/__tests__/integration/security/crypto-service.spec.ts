import * as crypto from 'crypto'; // Using Node.js crypto for underlying operations

// Mock for a KeyManagementService (KMS) or secure key storage
const mockKeyManagementService = {
  getDeviceKey: jest.fn(), // (deviceId: string, keyType: 'symmetric' | 'asymmetric_public' | 'asymmetric_private') => Promise<{ key: string | Buffer; algorithm: string } | null>
  generateDeviceKey: jest.fn(), // (deviceId: string, keyType: 'symmetric' | 'asymmetric') => Promise<{ keyId: string; publicKey?: string }>
};

// Placeholder for actual CryptoService implementation
// import { CryptoService } from '../../../../integration/security/crypto-service';

interface EncryptedData {
  ciphertext: string; // Base64 encoded
  iv: string; // Base64 encoded initialization vector
  authTag?: string; // Base64 encoded, for AEAD ciphers like GCM
  algorithm: string; // e.g., 'aes-256-gcm'
}

interface SignatureResult {
  signature: string; // Base64 encoded
  algorithm: string; // e.g., 'sha256WithRSAEncryption'
}

class CryptoService {
  constructor(private kms: typeof mockKeyManagementService) {}

  async encryptData(deviceId: string, plaintext: string | Buffer): Promise<EncryptedData | null> {
    const keyInfo = await this.kms.getDeviceKey(deviceId, 'symmetric');
    if (!keyInfo || !keyInfo.key) throw new Error('Symmetric key not found for device.');
    
    const key = Buffer.from(keyInfo.key, 'hex'); // Assuming key is hex encoded in KMS
    const iv = crypto.randomBytes(12); // For GCM, 12 bytes is common
    // Example using aes-256-gcm. Real implementation would use keyInfo.algorithm
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = '';
    if (Buffer.isBuffer(plaintext)) {
      encrypted = cipher.update(plaintext, undefined, 'base64');
    } else { // string
      encrypted = cipher.update(plaintext, 'utf8', 'base64');
    }
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();

    return {
      ciphertext: encrypted,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      algorithm: 'aes-256-gcm', // Should come from keyInfo or config
    };
  }

  async decryptData(deviceId: string, encryptedPayload: EncryptedData): Promise<string | null> {
    const keyInfo = await this.kms.getDeviceKey(deviceId, 'symmetric');
    if (!keyInfo || !keyInfo.key) throw new Error('Symmetric key not found for device.');

    const key = Buffer.from(keyInfo.key, 'hex');
    const iv = Buffer.from(encryptedPayload.iv, 'base64');
    const authTag = encryptedPayload.authTag ? Buffer.from(encryptedPayload.authTag, 'base64') : undefined;

    // Ensure algorithm matches, e.g., 'aes-256-gcm'
    if (encryptedPayload.algorithm !== 'aes-256-gcm') throw new Error('Unsupported decryption algorithm.');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    if (authTag) {
      decipher.setAuthTag(authTag);
    }

    let decrypted = decipher.update(encryptedPayload.ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  async signData(deviceId: string, dataToSign: string | Buffer): Promise<SignatureResult | null> {
    const keyInfo = await this.kms.getDeviceKey(deviceId, 'asymmetric_private');
    if (!keyInfo || !keyInfo.key) throw new Error('Private signing key not found for device.');

    // Assuming keyInfo.key is a PEM formatted private key and algorithm is like 'RSA-SHA256'
    // For Node.js crypto, algorithm for sign is just 'SHA256', 'SHA512' etc.
    // The key type (RSA, EC) determines the signature algorithm.
    const signAlgorithm = 'SHA256'; // This should align with key type from KMS
    const signer = crypto.createSign(signAlgorithm);
    signer.update(dataToSign);
    signer.end();
    const signature = signer.sign(keyInfo.key as string, 'base64'); // Cast as string for PEM

    return {
      signature,
      algorithm: keyInfo.algorithm || 'SHA256withRSA', // More descriptive algorithm name
    };
  }

  async verifySignature(
    deviceId: string, // Or use a keyId/publicKey directly if not device-specific
    dataToVerify: string | Buffer,
    signatureResult: SignatureResult
  ): Promise<boolean> {
    const keyInfo = await this.kms.getDeviceKey(deviceId, 'asymmetric_public');
    if (!keyInfo || !keyInfo.key) throw new Error('Public verification key not found for device.');

    const verifyAlgorithm = 'SHA256'; // Must match signing algorithm part
    const verifier = crypto.createVerify(verifyAlgorithm);
    verifier.update(dataToVerify);
    verifier.end();
    
    return verifier.verify(keyInfo.key as string, signatureResult.signature, 'base64');
  }
}

describe('CryptoService Integration Tests', () => {
  let cryptoService: CryptoService;
  const deviceId = 'crypto-dev-007';
  // Example keys (in real scenario, these come from KMS mock)
  const symmetricKeyHex = crypto.randomBytes(32).toString('hex'); // AES-256 key
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });


  beforeEach(() => {
    mockKeyManagementService.getDeviceKey.mockReset();
    mockKeyManagementService.generateDeviceKey.mockReset();
    cryptoService = new CryptoService(mockKeyManagementService);
  });

  describe('Encryption and Decryption', () => {
    const plaintext = 'This is a secret message for IoT device!';

    it('should encrypt and then decrypt data successfully', async () => {
      mockKeyManagementService.getDeviceKey.mockResolvedValue({ key: symmetricKeyHex, algorithm: 'aes-256-gcm' });
      
      const encrypted = await cryptoService.encryptData(deviceId, plaintext);
      expect(encrypted).not.toBeNull();
      expect(encrypted?.ciphertext).toBeDefined();
      expect(encrypted?.iv).toBeDefined();
      expect(encrypted?.authTag).toBeDefined();
      expect(encrypted?.algorithm).toBe('aes-256-gcm');

      if (!encrypted) throw new Error("Encryption failed"); // Type guard

      const decrypted = await cryptoService.decryptData(deviceId, encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('decryption should fail with wrong key (simulated by different deviceId for key fetch)', async () => {
      mockKeyManagementService.getDeviceKey
        .mockResolvedValueOnce({ key: symmetricKeyHex, algorithm: 'aes-256-gcm' }) // For encryption
        .mockResolvedValueOnce({ key: crypto.randomBytes(32).toString('hex'), algorithm: 'aes-256-gcm' }); // Different key for decryption

      const encrypted = await cryptoService.encryptData(deviceId, plaintext);
      expect(encrypted).not.toBeNull();
      if (!encrypted) throw new Error("Encryption failed");

      await expect(cryptoService.decryptData('other-device-id', encrypted)).rejects.toThrow(); // Error due to authTag mismatch or similar
    });

    it('decryption should fail if authTag is tampered', async () => {
        mockKeyManagementService.getDeviceKey.mockResolvedValue({ key: symmetricKeyHex, algorithm: 'aes-256-gcm' });
        const encrypted = await cryptoService.encryptData(deviceId, plaintext);
        expect(encrypted).not.toBeNull();
        if (!encrypted || !encrypted.authTag) throw new Error("Encryption or authTag failed");

        const tamperedEncrypted = { ...encrypted, authTag: Buffer.from(crypto.randomBytes(16)).toString('base64') };
        await expect(cryptoService.decryptData(deviceId, tamperedEncrypted)).rejects.toThrow(); // Typically "Unsupported state or bad message authentication code"
    });
  });

  describe('Signing and Verification', () => {
    const dataToSign = "Important IoT command payload";

    it('should sign data and then verify the signature successfully', async () => {
      mockKeyManagementService.getDeviceKey
        .mockResolvedValueOnce({ key: privateKey, algorithm: 'SHA256withRSA' }) // For signing
        .mockResolvedValueOnce({ key: publicKey, algorithm: 'SHA256withRSA' });  // For verification

      const signatureResult = await cryptoService.signData(deviceId, dataToSign);
      expect(signatureResult).not.toBeNull();
      expect(signatureResult?.signature).toBeDefined();
      expect(signatureResult?.algorithm).toBe('SHA256withRSA');

      if (!signatureResult) throw new Error("Signing failed");

      const isValid = await cryptoService.verifySignature(deviceId, dataToSign, signatureResult);
      expect(isValid).toBe(true);
    });

    it('verification should fail if data is tampered', async () => {
      mockKeyManagementService.getDeviceKey
        .mockResolvedValueOnce({ key: privateKey, algorithm: 'SHA256withRSA' })
        .mockResolvedValueOnce({ key: publicKey, algorithm: 'SHA256withRSA' });

      const signatureResult = await cryptoService.signData(deviceId, dataToSign);
      expect(signatureResult).not.toBeNull();
      if (!signatureResult) throw new Error("Signing failed");

      const tamperedData = "Important IoT command payload (tampered)";
      const isValid = await cryptoService.verifySignature(deviceId, tamperedData, signatureResult);
      expect(isValid).toBe(false);
    });

    it('verification should fail if signature is incorrect', async () => {
      mockKeyManagementService.getDeviceKey.mockResolvedValue({ key: publicKey, algorithm: 'SHA256withRSA' });
      const incorrectSignature: SignatureResult = {
        signature: Buffer.from("completely-wrong-signature").toString('base64'),
        algorithm: 'SHA256withRSA'
      };
      const isValid = await cryptoService.verifySignature(deviceId, dataToSign, incorrectSignature);
      expect(isValid).toBe(false);
    });

    it('should throw if signing key is not found', async () => {
        mockKeyManagementService.getDeviceKey.mockResolvedValue(null);
        await expect(cryptoService.signData(deviceId, dataToSign)).rejects.toThrow('Private signing key not found for device.');
    });
  });
});