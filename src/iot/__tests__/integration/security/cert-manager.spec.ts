// Mock for a Certificate Authority (CA) client or service
const mockCaClient = {
  issueCertificate: jest.fn(), // (csr: string, deviceId: string) => Promise<{ certificate: string; serialNumber: string; expiresAt: Date }>
  revokeCertificate: jest.fn(), // (serialNumber: string, reason?: string) => Promise<void>
  getCertificateStatus: jest.fn(), // (serialNumber: string) => Promise<'good' | 'revoked' | 'unknown'>
  getCertificate: jest.fn(), // (serialNumber: string) => Promise<{ certificate: string; deviceId: string; serialNumber: string; expiresAt: Date; status: string } | null>
};

// Mock for a certificate storage (e.g., database, secure vault)
const mockCertStorage = {
  storeCertificate: jest.fn(), // (certDetails: StoredCertificate) => Promise<void>
  getCertificateBySerial: jest.fn(), // (serialNumber: string) => Promise<StoredCertificate | null>
  getCertificatesByDevice: jest.fn(), // (deviceId: string) => Promise<StoredCertificate[]>
  updateCertificateStatus: jest.fn(), // (serialNumber: string, status: 'good' | 'revoked') => Promise<void>
  deleteCertificate: jest.fn(), // (serialNumber: string) => Promise<void>
};

// Placeholder for actual CertificateManager implementation
// import { CertificateManager } from '../../../../integration/security/cert-manager';

interface CertificateDetails {
  certificate: string; // PEM encoded certificate
  serialNumber: string;
  deviceId: string;
  issuedAt: Date;
  expiresAt: Date;
  status: 'good' | 'revoked' | 'expired' | 'unknown';
}

// Type for what's stored, might be slightly different from what's returned externally
type StoredCertificate = Omit<CertificateDetails, 'status'> & { status: 'good' | 'revoked' };


class CertificateManager {
  constructor(
    private caClient: typeof mockCaClient,
    private certStorage: typeof mockCertStorage
  ) {}

  async issueNewCertificate(deviceId: string, csr: string /* Certificate Signing Request */): Promise<CertificateDetails> {
    if (!deviceId || !csr) throw new Error('Device ID and CSR are required.');

    const issuedCert = await this.caClient.issueCertificate(csr, deviceId);
    const newCertDetails: CertificateDetails = {
      certificate: issuedCert.certificate,
      serialNumber: issuedCert.serialNumber,
      deviceId,
      issuedAt: new Date(),
      expiresAt: issuedCert.expiresAt,
      status: 'good',
    };
    await this.certStorage.storeCertificate(newCertDetails);
    return newCertDetails;
  }

  async revokeCertificate(serialNumber: string, reason?: string): Promise<void> {
    if (!serialNumber) throw new Error('Serial number is required to revoke a certificate.');
    const cert = await this.certStorage.getCertificateBySerial(serialNumber);
    if (!cert) throw new Error(`Certificate with serial ${serialNumber} not found in storage.`);
    if (cert.status === 'revoked') {
        console.warn(`Certificate ${serialNumber} is already revoked.`);
        return;
    }

    await this.caClient.revokeCertificate(serialNumber, reason);
    await this.certStorage.updateCertificateStatus(serialNumber, 'revoked');
    // Optionally, also update the 'expiresAt' or a specific 'revokedAt' field if schema supports it
  }

  async getCertificateDetails(serialNumber: string): Promise<CertificateDetails | null> {
    if (!serialNumber) throw new Error('Serial number is required.');
    const storedCert = await this.certStorage.getCertificateBySerial(serialNumber);
    if (!storedCert) return null;
    
    // Check expiration
    let currentStatus = storedCert.status;
    if (currentStatus === 'good' && new Date() > new Date(storedCert.expiresAt)) {
        currentStatus = 'expired' as any; // Cast because StoredCertificate status is stricter
    }
    return { ...storedCert, status: currentStatus };
  }

  async listDeviceCertificates(deviceId: string): Promise<CertificateDetails[]> {
    if (!deviceId) throw new Error('Device ID is required.');
    const storedCerts = await this.certStorage.getCertificatesByDevice(deviceId);
    return storedCerts.map(cert => {
        let currentStatus = cert.status;
        if (currentStatus === 'good' && new Date() > new Date(cert.expiresAt)) {
            currentStatus = 'expired' as any;
        }
        return { ...cert, status: currentStatus };
    });
  }

  async checkCertificateValidity(serialNumber: string): Promise<'good' | 'revoked' | 'expired' | 'unknown'> {
    const details = await this.getCertificateDetails(serialNumber);
    if (!details) return 'unknown';
    return details.status;
  }
}

describe('CertificateManager Integration Tests', () => {
  let certManager: CertificateManager;
  const deviceId = 'cert-device-001';
  const csr = '-----BEGIN CERTIFICATE REQUEST-----\n...\n-----END CERTIFICATE REQUEST-----';

  beforeEach(() => {
    mockCaClient.issueCertificate.mockReset();
    mockCaClient.revokeCertificate.mockReset();
    mockCaClient.getCertificateStatus.mockReset();
    mockCaClient.getCertificate.mockReset();
    mockCertStorage.storeCertificate.mockReset();
    mockCertStorage.getCertificateBySerial.mockReset();
    mockCertStorage.getCertificatesByDevice.mockReset();
    mockCertStorage.updateCertificateStatus.mockReset();
    mockCertStorage.deleteCertificate.mockReset();

    certManager = new CertificateManager(mockCaClient, mockCertStorage);
  });

  describe('issueNewCertificate', () => {
    const issuedCertData = {
      certificate: '-----BEGIN CERTIFICATE-----\nISSUED_CERT_DATA\n-----END CERTIFICATE-----',
      serialNumber: 'SN123456789',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    };

    it('should issue a new certificate and store it', async () => {
      mockCaClient.issueCertificate.mockResolvedValue(issuedCertData);
      mockCertStorage.storeCertificate.mockResolvedValue(undefined);

      const result = await certManager.issueNewCertificate(deviceId, csr);

      expect(mockCaClient.issueCertificate).toHaveBeenCalledWith(csr, deviceId);
      expect(mockCertStorage.storeCertificate).toHaveBeenCalledWith(expect.objectContaining({
        certificate: issuedCertData.certificate,
        serialNumber: issuedCertData.serialNumber,
        deviceId,
        status: 'good',
        expiresAt: issuedCertData.expiresAt,
        issuedAt: expect.any(Date),
      }));
      expect(result.serialNumber).toBe(issuedCertData.serialNumber);
      expect(result.status).toBe('good');
    });

    it('should throw if CA client fails to issue certificate', async () => {
      mockCaClient.issueCertificate.mockRejectedValue(new Error('CA error: CSR invalid'));
      await expect(certManager.issueNewCertificate(deviceId, csr)).rejects.toThrow('CA error: CSR invalid');
    });
  });

  describe('revokeCertificate', () => {
    const serialNumber = 'SN_TO_REVOKE_123';
    const existingCert: StoredCertificate = {
      certificate: 'cert-data', serialNumber, deviceId,
      issuedAt: new Date(), expiresAt: new Date(Date.now() + 100000), status: 'good'
    };

    it('should revoke an active certificate via CA and update storage', async () => {
      mockCertStorage.getCertificateBySerial.mockResolvedValue(existingCert);
      mockCaClient.revokeCertificate.mockResolvedValue(undefined);
      mockCertStorage.updateCertificateStatus.mockResolvedValue(undefined);

      await certManager.revokeCertificate(serialNumber, 'compromised');

      expect(mockCaClient.revokeCertificate).toHaveBeenCalledWith(serialNumber, 'compromised');
      expect(mockCertStorage.updateCertificateStatus).toHaveBeenCalledWith(serialNumber, 'revoked');
    });

    it('should warn if certificate is already revoked in storage', async () => {
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        mockCertStorage.getCertificateBySerial.mockResolvedValue({ ...existingCert, status: 'revoked' });
        await certManager.revokeCertificate(serialNumber);
        expect(mockCaClient.revokeCertificate).not.toHaveBeenCalled();
        expect(consoleWarnSpy).toHaveBeenCalledWith(`Certificate ${serialNumber} is already revoked.`);
        consoleWarnSpy.mockRestore();
    });

    it('should throw if certificate to revoke is not found in storage', async () => {
      mockCertStorage.getCertificateBySerial.mockResolvedValue(null);
      await expect(certManager.revokeCertificate(serialNumber)).rejects.toThrow(`Certificate with serial ${serialNumber} not found in storage.`);
    });
  });

  describe('getCertificateDetails & checkCertificateValidity', () => {
    const serial = 'SN_GET_DETAILS_456';
    const validCertStored: StoredCertificate = {
      certificate: 'valid-cert-pem', serialNumber: serial, deviceId,
      issuedAt: new Date(Date.now() - 100000),
      expiresAt: new Date(Date.now() + 1000000), // Expires in future
      status: 'good'
    };
    const expiredCertStored: StoredCertificate = {
      ...validCertStored, serialNumber: 'SN_EXPIRED_789',
      expiresAt: new Date(Date.now() - 100000) // Expired
    };

    it('should return certificate details for a valid, non-expired certificate', async () => {
      mockCertStorage.getCertificateBySerial.mockResolvedValue(validCertStored);
      const details = await certManager.getCertificateDetails(serial);
      expect(details?.status).toBe('good');
      expect(details?.serialNumber).toBe(serial);

      const validity = await certManager.checkCertificateValidity(serial);
      expect(validity).toBe('good');
    });

    it('should identify an expired certificate', async () => {
      mockCertStorage.getCertificateBySerial.mockResolvedValue(expiredCertStored);
      const details = await certManager.getCertificateDetails(expiredCertStored.serialNumber);
      expect(details?.status).toBe('expired');

      const validity = await certManager.checkCertificateValidity(expiredCertStored.serialNumber);
      expect(validity).toBe('expired');
    });

    it('should return "unknown" validity if certificate not found', async () => {
      mockCertStorage.getCertificateBySerial.mockResolvedValue(null);
      const validity = await certManager.checkCertificateValidity('SN_UNKNOWN');
      expect(validity).toBe('unknown');
    });
  });

  describe('listDeviceCertificates', () => {
    it('should list all certificates for a device, updating status for expired ones', async () => {
      const certs: StoredCertificate[] = [
        { certificate: 'c1', serialNumber: 's1', deviceId, issuedAt: new Date(), expiresAt: new Date(Date.now() + 1000), status: 'good' },
        { certificate: 'c2', serialNumber: 's2', deviceId, issuedAt: new Date(), expiresAt: new Date(Date.now() - 1000), status: 'good' }, // expired
        { certificate: 'c3', serialNumber: 's3', deviceId, issuedAt: new Date(), expiresAt: new Date(Date.now() + 1000), status: 'revoked' },
      ];
      mockCertStorage.getCertificatesByDevice.mockResolvedValue(certs);
      const results = await certManager.listDeviceCertificates(deviceId);
      expect(results.length).toBe(3);
      expect(results.find(c => c.serialNumber === 's1')?.status).toBe('good');
      expect(results.find(c => c.serialNumber === 's2')?.status).toBe('expired');
      expect(results.find(c => c.serialNumber === 's3')?.status).toBe('revoked');
    });
  });
});