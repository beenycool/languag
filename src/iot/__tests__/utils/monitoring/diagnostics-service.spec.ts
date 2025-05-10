// Mock for DeviceCommunicator (to send diagnostic commands)
const mockDiagnosticsDeviceCommunicator = {
  runDiagnostics: jest.fn(), // (deviceId: string, type: string, params?: any) => Promise<{ reportId: string; status: 'started' | 'failed_to_start'; error?: string }>
  getDiagnosticReport: jest.fn(), // (deviceId: string, reportId: string) => Promise<{ id: string; status: 'pending' | 'running' | 'completed' | 'failed'; data?: any; error?: string } | null>
};

// Mock for DiagnosticReportStorage
const mockReportStorage = {
  storeReportInitiation: jest.fn(), // (reportId, deviceId, type, timestamp) => Promise<void>
  updateReportStatus: jest.fn(), // (reportId, status, data?, error?) => Promise<void>
  getReport: jest.fn(), // (reportId) => Promise<any | null> // 'any' for simplified mock
};

// Placeholder for actual DiagnosticsService implementation
// import { DiagnosticsService } from '../../../../utils/monitoring/diagnostics-service';

type DiagnosticType = 'full' | 'network' | 'sensor_check' | 'custom';
interface DiagnosticReport {
  id: string;
  deviceId: string;
  type: DiagnosticType;
  status: 'pending' | 'running' | 'completed' | 'failed';
  parameters?: any;
  result?: any; // Actual diagnostic data
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

class DiagnosticsService {
  constructor(
    private communicator: typeof mockDiagnosticsDeviceCommunicator,
    private storage: typeof mockReportStorage
  ) {}

  async startDeviceDiagnostics(
    deviceId: string,
    type: DiagnosticType,
    parameters?: any
  ): Promise<{ reportId: string; initialStatus: 'started' | 'failed_to_start'; error?: string }> {
    if (!deviceId || !type) throw new Error('Device ID and diagnostic type are required.');

    const commResponse = await this.communicator.runDiagnostics(deviceId, type, parameters);
    if (commResponse.status === 'failed_to_start') {
      await this.storage.storeReportInitiation(commResponse.reportId || `failed-${Date.now()}`, deviceId, type, new Date());
      await this.storage.updateReportStatus(commResponse.reportId || `failed-${Date.now()}`, 'failed', undefined, commResponse.error || 'Failed to start diagnostics on device.');
      return { reportId: commResponse.reportId || `failed-${Date.now()}`, initialStatus: 'failed_to_start', error: commResponse.error };
    }

    await this.storage.storeReportInitiation(commResponse.reportId, deviceId, type, new Date());
    // Initial status in storage might be 'pending' or 'running' based on device ack
    await this.storage.updateReportStatus(commResponse.reportId, 'running'); 
    return { reportId: commResponse.reportId, initialStatus: 'started' };
  }

  async getDiagnosticReport(reportId: string): Promise<DiagnosticReport | null> {
    if (!reportId) throw new Error('Report ID is required.');
    // This might involve polling the device via communicator or checking storage if device pushes updates
    // For simplicity, let's assume storage is the source of truth after initiation/completion.
    // A more complex scenario would involve the communicator.getDiagnosticReport
    
    const storedReport = await this.storage.getReport(reportId);
    if (!storedReport) return null;

    // If communicator provides more up-to-date status for ongoing reports:
    // if (storedReport.status === 'running' || storedReport.status === 'pending') {
    //   const deviceReport = await this.communicator.getDiagnosticReport(storedReport.deviceId, reportId);
    //   if (deviceReport) {
    //      await this.storage.updateReportStatus(reportId, deviceReport.status, deviceReport.data, deviceReport.error);
    //      return { ...storedReport, ...deviceReport }; // Merge and return
    //   }
    // }
    return storedReport as DiagnosticReport; // Cast for now
  }

  // This method would be called by an external poller or when device pushes report completion
  async completeDiagnosticReport(reportId: string, status: 'completed' | 'failed', data?: any, error?: string): Promise<void> {
    if (!reportId) throw new Error('Report ID is required.');
    await this.storage.updateReportStatus(reportId, status, data, error);
    // Potentially emit an event
  }
}

describe('DiagnosticsService', () => {
  let diagnosticsService: DiagnosticsService;
  const deviceId = 'diag-robot-B7';
  const diagnosticType: DiagnosticType = 'full';

  beforeEach(() => {
    mockDiagnosticsDeviceCommunicator.runDiagnostics.mockReset();
    mockDiagnosticsDeviceCommunicator.getDiagnosticReport.mockReset();
    mockReportStorage.storeReportInitiation.mockReset();
    mockReportStorage.updateReportStatus.mockReset();
    mockReportStorage.getReport.mockReset();

    diagnosticsService = new DiagnosticsService(mockDiagnosticsDeviceCommunicator, mockReportStorage);
  });

  describe('startDeviceDiagnostics', () => {
    it('should successfully start diagnostics and store initiation record', async () => {
      const reportId = 'diag-rep-12345';
      mockDiagnosticsDeviceCommunicator.runDiagnostics.mockResolvedValue({ reportId, status: 'started' });
      mockReportStorage.storeReportInitiation.mockResolvedValue(undefined);
      mockReportStorage.updateReportStatus.mockResolvedValue(undefined);

      const result = await diagnosticsService.startDeviceDiagnostics(deviceId, diagnosticType);

      expect(result.reportId).toBe(reportId);
      expect(result.initialStatus).toBe('started');
      expect(mockDiagnosticsDeviceCommunicator.runDiagnostics).toHaveBeenCalledWith(deviceId, diagnosticType, undefined);
      expect(mockReportStorage.storeReportInitiation).toHaveBeenCalledWith(reportId, deviceId, diagnosticType, expect.any(Date));
      expect(mockReportStorage.updateReportStatus).toHaveBeenCalledWith(reportId, 'running');
    });

    it('should handle failure to start diagnostics on the device', async () => {
      const failReportId = 'diag-fail-67890';
      const errorMsg = 'Device is currently busy';
      mockDiagnosticsDeviceCommunicator.runDiagnostics.mockResolvedValue({ reportId: failReportId, status: 'failed_to_start', error: errorMsg });
      mockReportStorage.storeReportInitiation.mockResolvedValue(undefined);
      mockReportStorage.updateReportStatus.mockResolvedValue(undefined);

      const result = await diagnosticsService.startDeviceDiagnostics(deviceId, diagnosticType);

      expect(result.reportId).toBe(failReportId);
      expect(result.initialStatus).toBe('failed_to_start');
      expect(result.error).toBe(errorMsg);
      expect(mockReportStorage.storeReportInitiation).toHaveBeenCalledWith(failReportId, deviceId, diagnosticType, expect.any(Date));
      expect(mockReportStorage.updateReportStatus).toHaveBeenCalledWith(failReportId, 'failed', undefined, errorMsg);
    });

    it('should throw if deviceId or type is missing', async () => {
        // @ts-expect-error
        await expect(diagnosticsService.startDeviceDiagnostics(null, diagnosticType)).rejects.toThrow('Device ID and diagnostic type are required.');
        // @ts-expect-error
        await expect(diagnosticsService.startDeviceDiagnostics(deviceId, null)).rejects.toThrow('Device ID and diagnostic type are required.');
    });
  });

  describe('getDiagnosticReport', () => {
    it('should retrieve a stored diagnostic report', async () => {
      const reportId = 'rep-abc';
      const mockReport: DiagnosticReport = {
        id: reportId, deviceId, type: diagnosticType, status: 'completed',
        result: { allSystems: 'OK' }, createdAt: new Date(), updatedAt: new Date()
      };
      mockReportStorage.getReport.mockResolvedValue(mockReport);

      const report = await diagnosticsService.getDiagnosticReport(reportId);
      expect(report).toEqual(mockReport);
      expect(mockReportStorage.getReport).toHaveBeenCalledWith(reportId);
    });

    it('should return null if report is not found', async () => {
      mockReportStorage.getReport.mockResolvedValue(null);
      const report = await diagnosticsService.getDiagnosticReport('non-existent-report');
      expect(report).toBeNull();
    });
  });
  
  describe('completeDiagnosticReport', () => {
    it('should update the status of a diagnostic report to completed', async () => {
        const reportId = 'rep-xyz-running';
        const reportData = { log: "all checks passed", voltage: "5.01V" };
        mockReportStorage.updateReportStatus.mockResolvedValue(undefined);

        await diagnosticsService.completeDiagnosticReport(reportId, 'completed', reportData);
        expect(mockReportStorage.updateReportStatus).toHaveBeenCalledWith(reportId, 'completed', reportData, undefined);
    });

    it('should update the status of a diagnostic report to failed with an error', async () => {
        const reportId = 'rep-xyz-failed';
        const errorMsg = "Sensor S1 timeout";
        mockReportStorage.updateReportStatus.mockResolvedValue(undefined);

        await diagnosticsService.completeDiagnosticReport(reportId, 'failed', undefined, errorMsg);
        expect(mockReportStorage.updateReportStatus).toHaveBeenCalledWith(reportId, 'failed', undefined, errorMsg);
    });
  });
});