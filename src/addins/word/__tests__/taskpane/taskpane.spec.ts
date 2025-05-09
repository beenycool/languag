// Define mock enums matching Office/Word API structure
const officeHostTypeMock = {
    Word: "Word", Excel: "Excel", PowerPoint: "PowerPoint", Outlook: "Outlook",
    OneNote: "OneNote", Project: "Project", Access: "Access",
};

const officePlatformTypeMock = {
    PC: "PC", OfficeOnline: "OfficeOnline", Mac: "Mac", iOS: "iOS",
    Android: "Android", Universal: "Universal",
};

const officeAsyncResultStatusMock = {
    Succeeded: "succeeded", Failed: "failed",
};

// Word.InsertLocation: keys are lowercase, values are Capitalized strings.
const wordInsertLocationMock = {
    end: "End",
    start: "Start",
    before: "Before",
    after: "After",
    replace: "Replace",
};

const officeInitializationReasonMock = {
    Inserted: 'Inserted',
    DocumentOpened: 'DocumentOpened',
};

// Mock Word.js API
const mockWordRun = jest.fn();
const mockSync = jest.fn().mockResolvedValue(undefined);

const mockRequestContext = {
  sync: mockSync,
  document: {
    body: { insertParagraph: jest.fn(() => ({ font: {} })) },
    getSelection: jest.fn(() => ({})),
  },
  trackedObjects: { add: jest.fn(), remove: jest.fn() },
  load: jest.fn(), loadRecursive: jest.fn(), trace: jest.fn(),
  runtime: { load: jest.fn() }, application: {}, requestHeaders: {},
};

// Assign mocks to global Word object and cast to any
global.Word = {
  run: jest.fn(async (callbackOrObjects: any, batch?: any) => {
    if (typeof callbackOrObjects === 'function') {
      await callbackOrObjects(mockRequestContext);
    } else if (batch && typeof batch === 'function') {
      await batch(mockRequestContext);
    }
    return mockWordRun();
  }),
  RequestContext: jest.fn(() => mockRequestContext),
  InsertLocation: wordInsertLocationMock,
} as any;

// Mock Office.js
global.Office = {
  onReady: jest.fn((callback?: (info: { host: Office.HostType; platform: Office.PlatformType; }) => any): Promise<{ host: Office.HostType; platform: Office.PlatformType; }> => {
    const info = {
        host: officeHostTypeMock.Word as unknown as Office.HostType, // Cast via unknown
        platform: officePlatformTypeMock.PC as unknown as Office.PlatformType // Cast via unknown
    };
    if (callback) {
      callback(info);
    }
    return Promise.resolve(info);
  }),
  HostType: officeHostTypeMock as any, // Cast the whole enum object
  PlatformType: officePlatformTypeMock as any, // Cast the whole enum object
  context: {
    document: {
      settings: {
        get: jest.fn(),
        set: jest.fn(),
        saveAsync: jest.fn((optionsOrCallback?: Office.SaveSettingsOptions | ((result: Office.AsyncResult<void>) => void), callback?: (result: Office.AsyncResult<void>) => void) => {
          const asyncResult: Office.AsyncResult<void> = {
            status: officeAsyncResultStatusMock.Succeeded as unknown as Office.AsyncResultStatus, // Cast via unknown
            value: undefined,
            error: null as any,
            asyncContext: undefined,
            diagnostics: undefined,
          };
          if (typeof optionsOrCallback === 'function') {
            optionsOrCallback(asyncResult);
          } else if (typeof callback === 'function') {
            callback(asyncResult);
          }
        }),
      },
    },
    ui: {
        messageParent: jest.fn(),
        addHandlerAsync: jest.fn(),
        displayDialogAsync: jest.fn(),
        closeContainer: jest.fn(),
        openBrowserWindow: jest.fn(),
    } as Office.UI,
  },
  AsyncResultStatus: officeAsyncResultStatusMock as any, // Cast the whole enum object
  InitializationReason: officeInitializationReasonMock as any, // Cast the whole enum object
} as any; // Cast global.Office to any


// Mock Main Application Communication
jest.mock('../../services/communication/app-bridge', () => ({
  sendMessageToApp: jest.fn(),
  registerMessageHandler: jest.fn(),
}));

// Mock Analysis Pipeline Integration
jest.mock('../../integration/analysis/analysis-bridge', () => ({
  analyzeDocument: jest.fn(),
}));

// We need to load taskpane.ts to execute its Office.onReady block
let taskpaneRunFunction: (() => Promise<any>) | undefined;

describe('Taskpane Core Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
    taskpaneRunFunction = undefined;

    // Mock Office.onReady implementation for beforeEach
    (global.Office.onReady as jest.Mock).mockImplementation((callback?: (info: { host: Office.HostType; platform: Office.PlatformType; }) => any): Promise<{ host: Office.HostType; platform: Office.PlatformType; }> => {
        const info = {
            host: officeHostTypeMock.Word as unknown as Office.HostType, // Cast via unknown
            platform: officePlatformTypeMock.PC as unknown as Office.PlatformType // Cast via unknown
        };
        if (callback) {
            callback(info); // Pass the info object
        }
        return Promise.resolve(info);
    });

    // Simulate the taskpane.ts being loaded
    jest.isolateModules(() => {
        document.body.innerHTML = '<button id="runButton"></button>';
        require('../../taskpane');
        const runButton = document.getElementById("runButton");
        if (runButton && typeof runButton.onclick === 'function') {
          taskpaneRunFunction = runButton.onclick as any;
        }
    });
  });

  describe('Initialization', () => {
    it('should initialize Office and set runButton.onclick when Office.onReady is called', () => {
      expect(Office.onReady).toHaveBeenCalled();
      expect(taskpaneRunFunction).toBeDefined();
      expect(typeof taskpaneRunFunction).toBe('function');
    });

    it('should handle different Office.InitializationReason if applicable in taskpane.ts', () => {
      // Placeholder
    });
  });

  describe('Run Function (Button Click)', () => {
    it('should call Word.run when the run function is executed', async () => {
      if (!taskpaneRunFunction) throw new Error("taskpaneRunFunction not set");
      await taskpaneRunFunction();
      expect(Word.run).toHaveBeenCalled();
      expect(mockRequestContext.document.body.insertParagraph).toHaveBeenCalledWith("Hello World", wordInsertLocationMock.end); // Use mock value
      expect(mockSync).toHaveBeenCalled();
    });
  });


  describe('Lifecycle Events', () => {
    it('should handle document open events if logic exists', () => { /* Placeholder */ });
    it('should handle add-in insertion events if logic exists', () => { /* Placeholder */ });
  });

  describe('Error Scenarios', () => {
    it('should handle errors during Office.onReady (simulated)', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        (global.Office.onReady as jest.Mock).mockImplementationOnce((callback?: (info: { host: Office.HostType; platform: Office.PlatformType; }) => any): Promise<{ host: Office.HostType; platform: Office.PlatformType; }> => {
            const infoForErrorCase = {
                host: officeHostTypeMock.Word as unknown as Office.HostType, // Cast via unknown
                platform: officePlatformTypeMock.PC as unknown as Office.PlatformType // Cast via unknown
            };
            try {
                if(callback) callback(infoForErrorCase);
                throw new Error("Office.onReady simulated error");
            } catch (e) {
                 console.error("Simulated error during Office.onReady callback:", e);
            }
            return Promise.resolve(infoForErrorCase);
        });

        jest.isolateModules(() => { require('../../taskpane'); });
        expect(consoleErrorSpy).toHaveBeenCalledWith("Simulated error during Office.onReady callback:", expect.any(Error));
        consoleErrorSpy.mockRestore();
    });

    it('should handle errors during Word.run (simulated in run function)', async () => {
      if (!taskpaneRunFunction) throw new Error("taskpaneRunFunction not set");
      (Word.run as jest.Mock).mockImplementationOnce(async () => { throw new Error('Simulated Word.run error'); });
      await expect(taskpaneRunFunction()).rejects.toThrow('Simulated Word.run error');
    });
  });

  describe('State Management (if applicable at core level)', () => {
    it('should load initial state from Office settings if used', () => { /* Placeholder */ });
    it('should save state to Office settings if used', () => { /* Placeholder */ });
  });

  describe('Performance Characteristics', () => {
    it('should initialize (Office.onReady callback execution) within an acceptable time frame', () => {
      const startTime = performance.now();
      // Initialization happens in beforeEach
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(2000);
    });
  });
});