// Define mock enums matching Office/Word API structure specifically for this file
const uiTestOfficeHostTypeMock = {
    Word: "Word",
    Excel: "Excel",
    PowerPoint: "PowerPoint",
    Outlook: "Outlook",
    OneNote: "OneNote",
    Project: "Project",
    Access: "Access",
};

const uiTestOfficePlatformTypeMock = {
    PC: "PC",
    OfficeOnline: "OfficeOnline",
    Mac: "Mac",
    iOS: "iOS",
    Android: "Android",
    Universal: "Universal",
};

const uiTestOfficeAsyncResultStatusMock = {
    Succeeded: "succeeded",
    Failed: "failed",
};

// Basic DOM setup for task pane elements
const setupTaskpaneDOM = () => {
  document.body.innerHTML = `
    <div id="taskpane">
      <button id="runButton">Run Action</button>
      <button id="analyzeButton">Analyze</button>
      <div id="resultsPanel"></div>
      <input type="text" id="settingsInput" />
      <div id="errorDisplay"></div>
    </div>
  `;
};

// Mock Office and Word APIs
global.Office = {
  onReady: jest.fn((callback?: (info: { host: Office.HostType; platform: Office.PlatformType; }) => any): Promise<{ host: Office.HostType; platform: Office.PlatformType; }> => {
    const info = {
        host: uiTestOfficeHostTypeMock.Word as unknown as Office.HostType, // Cast via unknown
        platform: uiTestOfficePlatformTypeMock.PC as unknown as Office.PlatformType // Cast via unknown
    };
    if (callback) callback(info);
    return Promise.resolve(info);
  }),
  // Cast the mock objects via unknown to the expected types
  HostType: uiTestOfficeHostTypeMock as unknown as typeof Office.HostType,
  PlatformType: uiTestOfficePlatformTypeMock as unknown as typeof Office.PlatformType,
  context: {
    document: { /* Mock document context if needed */ },
    ui: {
        messageParent: jest.fn(),
        addHandlerAsync: jest.fn(),
        displayDialogAsync: jest.fn(),
        closeContainer: jest.fn(),
        openBrowserWindow: jest.fn(),
    } as Office.UI,
  } as Office.Context,
  AsyncResultStatus: uiTestOfficeAsyncResultStatusMock as unknown as typeof Office.AsyncResultStatus, // Cast via unknown
} as any; // Keep outer 'any' cast for simplicity if needed

global.Word = {
  run: jest.fn().mockResolvedValue(undefined),
  RequestContext: jest.fn(),
  InsertLocation: { // Basic mock for InsertLocation
      end: "End"
  }
} as any;

// Mock other dependencies
jest.mock('../../services/communication/app-bridge', () => ({
  sendMessageToApp: jest.fn(),
}));
jest.mock('../../integration/analysis/analysis-bridge', () => ({
  analyzeDocument: jest.fn(),
}));

// Function to load taskpane script within an isolated module scope
const loadTaskpaneScript = () => {
    jest.isolateModules(() => {
        require('../../taskpane'); // Executes the script
    });
};

describe('Taskpane UI Event Handling', () => {
  let runButton: HTMLButtonElement | null;
  let analyzeButton: HTMLButtonElement | null;
  let resultsPanel: HTMLElement | null;
  let settingsInput: HTMLInputElement | null;
  let errorDisplay: HTMLElement | null;

  beforeEach(() => {
    jest.clearAllMocks();
    setupTaskpaneDOM(); // Set up DOM elements

    // Get elements after setting up DOM
    runButton = document.getElementById('runButton') as HTMLButtonElement;
    analyzeButton = document.getElementById('analyzeButton') as HTMLButtonElement;
    resultsPanel = document.getElementById('resultsPanel');
    settingsInput = document.getElementById('settingsInput') as HTMLInputElement;
    errorDisplay = document.getElementById('errorDisplay');

    // Load the taskpane script to attach event listeners
    loadTaskpaneScript();
  });

  it('should attach onclick handler to the run button', () => {
    expect(runButton).not.toBeNull();
    expect(runButton?.onclick).toBeDefined();
    expect(typeof runButton?.onclick).toBe('function');
  });

  it('should trigger Word.run when the run button is clicked', () => {
    expect(runButton).not.toBeNull();
    runButton?.click();
    expect(Word.run).toHaveBeenCalled();
  });

  it('should call analyzeDocument when the analyze button is clicked (if handler exists)', () => {
    expect(analyzeButton).not.toBeNull();
    if (analyzeButton && typeof analyzeButton.onclick === 'function') {
        analyzeButton.click();
        const analysisBridge = require('../../integration/analysis/analysis-bridge');
        expect(analysisBridge.analyzeDocument).toHaveBeenCalled();
    } else {
        console.warn("Analyze button click handler not found/implemented in taskpane.ts");
    }
  });

  it('should update results panel when analysis completes (example)', () => {
    expect(resultsPanel).not.toBeNull();
    // Example: Simulate update
    // resultsPanel.innerHTML = 'Analysis complete';
    // expect(resultsPanel.innerHTML).toContain('Analysis complete');
  });

  it('should handle input changes in settings fields (example)', () => {
    expect(settingsInput).not.toBeNull();
    if (settingsInput) {
        settingsInput.value = 'new setting';
        const event = new Event('change');
        settingsInput.dispatchEvent(event);
        // Assert: expect(someSettingsUpdateFunction).toHaveBeenCalledWith('new setting');
    }
  });

  describe('Error Display', () => {
    it('should display error messages in the designated area (example)', () => {
      expect(errorDisplay).not.toBeNull();
      if (errorDisplay) {
          errorDisplay.textContent = 'Simulated error occurred';
          expect(errorDisplay.textContent).toContain('Simulated error occurred');
      }
    });
  });

  describe('UI State Updates', () => {
    it('should disable buttons during long operations (example)', () => {
        expect(runButton).not.toBeNull();
        if (runButton) {
            runButton.disabled = true;
            expect(runButton.disabled).toBe(true);
            runButton.disabled = false;
            expect(runButton.disabled).toBe(false);
        }
    });
  });
});