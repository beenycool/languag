// Define mock enums matching Office/Word API structure specifically for this file
const integrationTestOfficeHostTypeMock = {
    Word: "Word", Excel: "Excel", PowerPoint: "PowerPoint", Outlook: "Outlook",
    OneNote: "OneNote", Project: "Project", Access: "Access",
};

const integrationTestOfficePlatformTypeMock = {
    PC: "PC", OfficeOnline: "OfficeOnline", Mac: "Mac", iOS: "iOS",
    Android: "Android", Universal: "Universal",
};

const integrationTestOfficeAsyncResultStatusMock = {
    Succeeded: "succeeded", Failed: "failed",
};

// Define OWAView enum values as string literals
const OWAViewType = {
    OneColumn: "OneColumn",
    TwoColumns: "TwoColumns",
    ThreeColumns: "ThreeColumns",
} as const;


const integrationTestWordInsertLocationMock = {
    end: "End", start: "Start", before: "Before", after: "After", replace: "Replace",
};

// Mock Word.js API
const integrationMockSync = jest.fn().mockResolvedValue(undefined);
const integrationMockInsertParagraph = jest.fn(() => ({ font: {} }));
const integrationMockRequestContext = {
  sync: integrationMockSync,
  document: { body: { insertParagraph: integrationMockInsertParagraph } },
  trackedObjects: { add: jest.fn(), remove: jest.fn() },
  load: jest.fn(), loadRecursive: jest.fn(), trace: jest.fn(),
  runtime: { load: jest.fn() }, application: {}, requestHeaders: {},
};
global.Word = {
  run: jest.fn(async (callback) => {
    await callback(integrationMockRequestContext);
  }),
  RequestContext: jest.fn(() => integrationMockRequestContext),
  InsertLocation: integrationTestWordInsertLocationMock,
} as any;

// Mock Office.js API
global.Office = {
  onReady: jest.fn((callback?: (info: { host: Office.HostType; platform: Office.PlatformType; }) => any): Promise<{ host: Office.HostType; platform: Office.PlatformType; }> => {
    const info = {
        host: integrationTestOfficeHostTypeMock.Word as unknown as Office.HostType,
        platform: integrationTestOfficePlatformTypeMock.PC as unknown as Office.PlatformType
    };
    if (callback) callback(info);
    return Promise.resolve(info);
  }),
  HostType: integrationTestOfficeHostTypeMock as unknown as typeof Office.HostType,
  PlatformType: integrationTestOfficePlatformTypeMock as unknown as typeof Office.PlatformType,
  context: {
    host: integrationTestOfficeHostTypeMock.Word as unknown as Office.HostType,
    platform: integrationTestOfficePlatformTypeMock.PC as unknown as Office.PlatformType,
    document: { // Cast document mock to 'any' to avoid missing property errors
        settings: { get: jest.fn(), set: jest.fn(), saveAsync: jest.fn() },
        mode: Office.DocumentMode.ReadWrite, // Keep relevant properties if needed
        url: 'http://mock.document.url',
        // Add other necessary document properties used by your code
    } as any, // Cast document to any
    ui: {
        messageParent: jest.fn(),
        addHandlerAsync: jest.fn(),
        displayDialogAsync: jest.fn(),
        closeContainer: jest.fn(),
        openBrowserWindow: jest.fn(),
    } as Office.UI,
    commerceAllowed: false,
    contentLanguage: 'en-US',
    diagnostics: {
        host: integrationTestOfficeHostTypeMock.Word as unknown as Office.HostType,
        platform: integrationTestOfficePlatformTypeMock.PC as unknown as Office.PlatformType,
        version: '16.0',
        hostName: 'Word',
        hostVersion: '16.0.12345.67890',
        OWAView: OWAViewType.OneColumn as "OneColumn" | "TwoColumns" | "ThreeColumns",
    } as any, // Cast diagnostics to any
    displayLanguage: 'en-US',
    auth: { getAccessToken: jest.fn() } as any,
    mailbox: undefined as any, // Explicitly cast mailbox: undefined to any
    roamingSettings: undefined as any, // Explicitly cast roamingSettings: undefined to any
    requirements: { isSetSupported: jest.fn() } as any,
    license: { getIsTrial: jest.fn(() => false) } as any,
    officeTheme: {
        bodyBackgroundColor: '#FFFFFF', bodyForegroundColor: '#000000',
        controlBackgroundColor: '#F0F0F0', controlForegroundColor: '#000000',
    } as any,
    partitionKey: '', // Changed from undefined to empty string
    sensitivityLabelsCatalog: undefined as any, // Explicitly cast sensitivityLabelsCatalog: undefined to any
    touchEnabled: false,
    urls: { AppDomain: undefined } as any,
  } as Office.Context, // Keep outer cast if needed, but inner casts might suffice
  AsyncResultStatus: integrationTestOfficeAsyncResultStatusMock as unknown as typeof Office.AsyncResultStatus,
  DocumentMode: { // Add mock for DocumentMode enum used above
      ReadOnly: 0,
      ReadWrite: 1,
  } as typeof Office.DocumentMode,
} as any;

// Mock bridges
const mockSendMessageToAppIntegration = jest.fn();
const mockRegisterMessageHandlerIntegration = jest.fn();
const mockAnalyzeDocumentIntegration = jest.fn().mockResolvedValue({ suggestions: [] });

jest.mock('../../services/communication/app-bridge', () => ({
  sendMessageToApp: mockSendMessageToAppIntegration,
  registerMessageHandler: mockRegisterMessageHandlerIntegration,
}));
jest.mock('../../integration/analysis/analysis-bridge', () => ({
  analyzeDocument: mockAnalyzeDocumentIntegration,
}));

// Function to load taskpane script
const loadTaskpaneScriptIntegration = () => {
    jest.isolateModules(() => {
        document.body.innerHTML = '<button id="runButton"></button><button id="analyzeButton"></button>';
        require('../../taskpane');
    });
};

describe('Taskpane Integration Tests', () => {
  let runButton: HTMLButtonElement | null;
  let analyzeButton: HTMLButtonElement | null;
  let taskpaneRunFunctionIntegration: (() => Promise<any>) | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '<button id="runButton"></button><button id="analyzeButton"></button>';
    taskpaneRunFunctionIntegration = undefined;

    jest.isolateModules(() => {
        require('../../taskpane');
        runButton = document.getElementById("runButton") as HTMLButtonElement;
        analyzeButton = document.getElementById("analyzeButton") as HTMLButtonElement;
        if (runButton && typeof runButton.onclick === 'function') {
            taskpaneRunFunctionIntegration = runButton.onclick as any;
        }
        if (analyzeButton) {
             analyzeButton.onclick = async () => {
                 try {
                     const analysisBridge = require('../../integration/analysis/analysis-bridge');
                     const result = await analysisBridge.analyzeDocument();
                     const appBridge = require('../../services/communication/app-bridge');
                     appBridge.sendMessageToApp({ type: 'ANALYSIS_COMPLETE', payload: result });
                 } catch (error: any) {
                     console.error("Error in mock analyze click handler", error);
                     const appBridge = require('../../services/communication/app-bridge');
                     appBridge.sendMessageToApp({ type: 'ANALYSIS_ERROR', payload: { message: error?.message || 'Failed' } });
                 }
             };
        }
    });
  });

  describe('Word Interaction', () => {
    it('should call Word.run with context when run action is triggered', async () => {
      if (!taskpaneRunFunctionIntegration) throw new Error("Run function not attached");
      await taskpaneRunFunctionIntegration();
      expect(Word.run).toHaveBeenCalled();
      expect(integrationMockInsertParagraph).toHaveBeenCalledWith("Hello World", integrationTestWordInsertLocationMock.end);
      expect(integrationMockSync).toHaveBeenCalled();
    });
  });

  describe('Main App Communication (App Bridge)', () => {
    it('should register message handlers on initialization', () => {
      expect(mockRegisterMessageHandlerIntegration).toHaveBeenCalled();
    });

    it('should send ANALYSIS_COMPLETE message after successful analysis', async () => {
        expect(analyzeButton).not.toBeNull();
        if (analyzeButton?.onclick) {
            mockAnalyzeDocumentIntegration.mockResolvedValueOnce({ suggestions: [{id: 's1'}] });
            await analyzeButton.onclick({} as MouseEvent);
            expect(mockSendMessageToAppIntegration).toHaveBeenCalledWith({
                type: 'ANALYSIS_COMPLETE',
                payload: { suggestions: [{id: 's1'}] }
            });
        } else {
             throw new Error("Analyze button or onclick handler not found");
        }
    });

     it('should send ANALYSIS_ERROR message after failed analysis', async () => {
        expect(analyzeButton).not.toBeNull();
        if (analyzeButton?.onclick) {
            const testError = new Error('Analysis failed miserably');
            mockAnalyzeDocumentIntegration.mockRejectedValueOnce(testError);
            await analyzeButton.onclick({} as MouseEvent);
            expect(mockSendMessageToAppIntegration).toHaveBeenCalledWith({
                type: 'ANALYSIS_ERROR',
                payload: { message: testError.message }
            });
        } else {
             throw new Error("Analyze button or onclick handler not found");
        }
    });

    it('should react to messages received from the main app', () => {
      expect(mockRegisterMessageHandlerIntegration).toHaveBeenCalled();
      if (mockRegisterMessageHandlerIntegration.mock.calls.length === 0) {
          throw new Error("Message handler not registered");
      }
      const messageHandler = mockRegisterMessageHandlerIntegration.mock.calls[0][0];
      expect(messageHandler).toBeDefined();

      const mockMessage = { type: 'SETTING_CHANGED', payload: { theme: 'dark' } };
      messageHandler(mockMessage);
      // Assert task pane reaction
    });
  });

  describe('Analysis Pipeline Integration (Analysis Bridge)', () => {
    it('should call analyzeDocument when analysis is triggered', async () => {
        expect(analyzeButton).not.toBeNull();
         if (analyzeButton?.onclick) {
            await analyzeButton.onclick({} as MouseEvent);
            expect(mockAnalyzeDocumentIntegration).toHaveBeenCalled();
         } else {
             throw new Error("Analyze button or onclick handler not found");
         }
    });
  });
});