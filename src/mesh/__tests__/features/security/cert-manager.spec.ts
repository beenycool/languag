// src/mesh/__tests__/features/security/cert-manager.spec.ts
import { CertificateManager, CertificateInfo, CertificateRequestOptions } from '../../../features/security/cert-manager';
import { ILoggingService, LogLevel } from '../../../../microservices/services/management/logging-service';

const mockLogger: ILoggingService = {
  log: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn(),
  debug: jest.fn(), trace: jest.fn(), addTransport: jest.fn().mockResolvedValue(undefined),
  removeTransport: jest.fn().mockResolvedValue(undefined), setLogLevel: jest.fn(),
  getLogLevel: jest.fn().mockReturnValue(LogLevel.INFO), getChildLogger: jest.fn().mockReturnThis(),
};

describe('CertificateManager', () => {
  let certManager: CertificateManager;
  const serviceId1 = 'service-alpha';
  const serviceId2 = 'service-beta';

  beforeEach(() => {
    Object.values(mockLogger).forEach(m => { if(jest.isMockFunction(m)) m.mockClear(); });
    certManager = new CertificateManager(mockLogger);
    // Mock the initializeSelfSignedCA to avoid actual crypto ops in unit tests,
    // and to control the rootCA value.
    certManager['initializeSelfSignedCA'] = jest.fn().mockImplementation(async () => {
      certManager['rootCA'] = { cert: "---MOCK CA CERT---", privateKey: "---MOCK CA KEY---" };
    });
    jest.useFakeTimers(); // Use Jest's fake timers for date manipulation
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    test('should initialize and log creation', () => {
      expect(certManager).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith('[CertManager] CertificateManager initialized.');
    });
  });

  describe('Certificate Issuance (getCertificate)', () => {
    test('should issue a new certificate if one does not exist', async () => {
      const certInfo = await certManager.getCertificate(serviceId1);
      expect(certInfo).not.toBeNull();
      expect(certInfo?.serviceId).toBe(serviceId1);
      expect(certInfo?.commonName).toBe(`${serviceId1}.mesh.local`);
      expect(certInfo?.certificate).toContain(`CERTIFICATE FOR ${serviceId1}`);
      expect(certInfo?.caCertificate).toBe("---MOCK CA CERT---");
      expect(certManager['certificates'].has(serviceId1)).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        `[CertManager] Issued new certificate for ${serviceId1}`,
        expect.objectContaining({ commonName: `${serviceId1}.mesh.local` })
      );
    });

    test('should use custom validityDays from options', async () => {
      const validityDays = 30;
      const now = new Date('2024-01-01T00:00:00.000Z');
      jest.setSystemTime(now);

      const certInfo = await certManager.getCertificate(serviceId1, { validityDays });
      expect(certInfo).not.toBeNull();
      const expectedExpiry = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);
      expect(certInfo?.expiresAt.toISOString()).toBe(expectedExpiry.toISOString());
    });
    
    test('should return existing valid certificate if available', async () => {
      const initialCert = await certManager.getCertificate(serviceId1); // Issue first time
      (mockLogger.info as jest.Mock).mockClear(); // Clear logs from first issuance

      const retrievedCert = await certManager.getCertificate(serviceId1); // Request again
      expect(retrievedCert).toEqual(initialCert); // Should be the same object/details
      expect(mockLogger.info).toHaveBeenCalledWith(`[CertManager] Returning existing certificate for ${serviceId1}`);
    });

    test('should return null if root CA cannot be initialized', async () => {
      // Override mock to simulate CA init failure
      certManager['initializeSelfSignedCA'] = jest.fn().mockImplementation(async () => {
        certManager['rootCA'] = undefined;
      });
      certManager['rootCA'] = undefined; // Ensure it's initially undefined

      const certInfo = await certManager.getCertificate(serviceId1);
      expect(certInfo).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith('[CertManager] Cannot issue certificate: Root CA not available.');
    });
  });

  describe('Certificate Renewal', () => {
    test('should renew a certificate (issue a new one)', async () => {
      const originalCert = await certManager.getCertificate(serviceId1);
      expect(originalCert).not.toBeNull();
      const originalSerial = originalCert?.serialNumber;
      (mockLogger.info as jest.Mock).mockClear();

      // Advance time to make the original cert seem older for renewal logic if it checked validity strictly
      jest.advanceTimersByTime(10 * 24 * 60 * 60 * 1000); // 10 days

      const renewedCert = await certManager.renewCertificate(serviceId1);
      expect(renewedCert).not.toBeNull();
      expect(renewedCert?.serviceId).toBe(serviceId1);
      expect(renewedCert?.serialNumber).not.toBe(originalSerial); // New cert should have new serial
      expect(mockLogger.info).toHaveBeenCalledWith(`[CertManager] Renewing certificate for service: ${serviceId1}`);
      expect(mockLogger.info).toHaveBeenCalledWith(
        `[CertManager] Issued new certificate for ${serviceId1}`, // Called by getCertificate during renew
        expect.anything()
      );
    });
    
    test('getCertificate should trigger renewal if existing cert is close to expiry', async () => {
      const validityDays = 10; // Short validity for test
      const now = new Date('2024-01-01T00:00:00.000Z');
      jest.setSystemTime(now);

      // Issue initial cert
      await certManager.getCertificate(serviceId1, { validityDays });
      const initialCert = certManager['certificates'].get(serviceId1);
      expect(initialCert).toBeDefined();
      
      // Advance time so that less than 1/3 of validity is left (e.g., 8 days for a 10-day cert)
      // 10 days * (2/3) = 6.66 days. So advance by 7 days.
      jest.advanceTimersByTime(7 * 24 * 60 * 60 * 1000); 
      (mockLogger.info as jest.Mock).mockClear();

      const certAfterTime = await certManager.getCertificate(serviceId1, { validityDays }); // Request again
      expect(certAfterTime?.serialNumber).not.toBe(initialCert?.serialNumber); // Should be a new cert
      expect(mockLogger.info).toHaveBeenCalledWith(`[CertManager] Existing certificate for ${serviceId1} is expiring soon, attempting renewal.`);
      expect(mockLogger.info).toHaveBeenCalledWith(`[CertManager] Renewing certificate for service: ${serviceId1}`);
    });
  });

  describe('Certificate Revocation', () => {
    beforeEach(async () => {
      // Ensure a certificate exists for serviceId1
      await certManager.getCertificate(serviceId1);
    });

    test('should revoke an existing certificate by serviceId', async () => {
      expect(certManager['certificates'].has(serviceId1)).toBe(true);
      const revoked = await certManager.revokeCertificate(serviceId1);
      expect(revoked).toBe(true);
      expect(certManager['certificates'].has(serviceId1)).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`[CertManager] Certificate for ${serviceId1}`), // Serial might be part of this log
        // expect.anything()
      );
    });

    test('should revoke an existing certificate by serviceId and serialNumber', async () => {
      const cert = certManager['certificates'].get(serviceId1);
      expect(cert).toBeDefined();
      const serial = cert!.serialNumber;

      const revoked = await certManager.revokeCertificate(serviceId1, serial);
      expect(revoked).toBe(true);
      expect(certManager['certificates'].has(serviceId1)).toBe(false);
    });

    test('should not revoke if serialNumber does not match', async () => {
      const revoked = await certManager.revokeCertificate(serviceId1, 'non-matching-serial');
      expect(revoked).toBe(false);
      expect(certManager['certificates'].has(serviceId1)).toBe(true); // Still there
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `[CertManager] Certificate for ${serviceId1} (Serial: non-matching-serial) not found for revocation.`
      );
    });

    test('should return false if revoking non-existent certificate', async () => {
      const revoked = await certManager.revokeCertificate('non-existent-service');
      expect(revoked).toBe(false);
    });
  });

  describe('Trust Bundle', () => {
    test('should return the root CA certificate in the trust bundle', async () => {
      // Ensure CA is initialized (it is by the mock in beforeEach)
      await certManager.getCertificate(serviceId1); // Triggers CA init if not already done

      const trustBundle = await certManager.getTrustBundle();
      expect(trustBundle).toHaveLength(1);
      expect(trustBundle[0]).toBe("---MOCK CA CERT---");
    });

    test('should return empty array if no root CA is configured', async () => {
      certManager['rootCA'] = undefined; // Simulate no CA
      const trustBundle = await certManager.getTrustBundle();
      expect(trustBundle).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith('[CertManager] Trust bundle requested but no Root CA configured.');
    });
  });
});