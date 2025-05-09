// Mock Office.js APIs relevant to ribbon commands
const mockShowAsTaskpane = jest.fn().mockResolvedValue(undefined);
const mockAssociate = jest.fn();

// Mock the AddinCommands Event object
const mockEventCompleted = jest.fn();
const mockEvent: Office.AddinCommands.Event = {
  completed: mockEventCompleted,
  source: { // Added missing required property 'source'
      id: "mockButtonId" // Example placeholder ID
  } as Office.AddinCommands.Source,
};

// Mock Word.js APIs
const mockRangeInsertTextRibbon = jest.fn();
const mockSyncRibbon = jest.fn().mockResolvedValue(undefined);
const mockSelectionRibbon = {
  insertText: mockRangeInsertTextRibbon,
};
const mockContextRibbon = {
  sync: mockSyncRibbon,
  document: {
    getSelection: jest.fn(() => mockSelectionRibbon),
  },
};

global.Word = {
  run: jest.fn(async (callback) => {
    await callback(mockContextRibbon);
  }),
  InsertLocation: {
    replace: "Replace",
  },
} as any;

// Complete HostType mock - remove individual casts
const mockRibbonHostType = {
    Word: "Word",
    Excel: "Excel",
    PowerPoint: "PowerPoint",
    Outlook: "Outlook",
    OneNote: "OneNote",
    Project: "Project",
    Access: "Access",
};


// Set up global Office object with necessary mocks
global.Office = {
  onReady: jest.fn((callback) => {
    // Immediately call the callback for testing purposes
    // Cast host type via unknown
    callback({ host: mockRibbonHostType.Word as unknown as Office.HostType });
  }),
  // Cast the entire mock object via unknown
  HostType: mockRibbonHostType as unknown as typeof Office.HostType,
  addin: {
    showAsTaskpane: mockShowAsTaskpane,
  },
  actions: {
    associate: mockAssociate,
  },
  context: {} as any,
} as any;

// Import the functions after mocks are set up.
// Use isolateModules to test the registration logic cleanly.
let showTaskPane: () => Promise<void>;
let insertHelloWorld: (event: Office.AddinCommands.Event) => Promise<void>;

// Function to run registration logic in isolation
const runRegistration = () => {
    jest.isolateModules(() => {
        require('../../ribbon/ribbon-commands');
        // Capture functions if testing global fallback
        showTaskPane = (globalThis as any).showTaskPane;
        insertHelloWorld = (globalThis as any).insertHelloWorld;
    });
};

// Run initial registration to capture associated functions
runRegistration();

// Capture associated functions correctly
let associatedShowTaskPane: () => Promise<void>;
let associatedInsertHelloWorld: (event: Office.AddinCommands.Event) => Promise<void>;

const showTaskPaneCall = mockAssociate.mock.calls.find(c => c[0] === 'showTaskPane');
if (showTaskPaneCall) {
    associatedShowTaskPane = showTaskPaneCall[1];
}
const insertHelloWorldCall = mockAssociate.mock.calls.find(c => c[0] === 'insertHelloWorld');
if (insertHelloWorldCall) {
    associatedInsertHelloWorld = insertHelloWorldCall[1];
}


describe('Ribbon Commands', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset associate mock before each test's registration run
    mockAssociate.mockClear();
    // Rerun registration only if the test specifically needs a fresh state
    // runRegistration(); // Often not needed if just testing execution
  });

  describe('Registration', () => {
    // Rerun registration in isolation for these specific tests
    beforeEach(() => {
        runRegistration();
    });

    it('should call Office.actions.associate for defined commands', () => {
      expect(mockAssociate).toHaveBeenCalledWith("showTaskPane", expect.any(Function));
      expect(mockAssociate).toHaveBeenCalledWith("insertHelloWorld", expect.any(Function));
    });

     it('should assign functions to globalThis if Office.actions.associate is not available', () => {
        // Temporarily modify the global Office object (using 'any' to bypass read-only)
        const originalActions = (global.Office as any).actions;
        (global.Office as any).actions = undefined; // Simulate missing actions

        jest.isolateModules(() => {
            require('../../ribbon/ribbon-commands');
            // Check global scope
            expect((globalThis as any).showTaskPane).toBeDefined();
            expect(typeof (globalThis as any).showTaskPane).toBe('function');
            expect((globalThis as any).insertHelloWorld).toBeDefined();
            expect(typeof (globalThis as any).insertHelloWorld).toBe('function');

             // Clean up global scope
             delete (globalThis as any).showTaskPane;
             delete (globalThis as any).insertHelloWorld;
        });

        (global.Office as any).actions = originalActions; // Restore actions
    });
  });

  describe('showTaskPane Command Execution', () => {
    it('should call Office.addin.showAsTaskpane', async () => {
       if (!associatedShowTaskPane) {
           // If associate wasn't called (e.g., fallback), test global function
           associatedShowTaskPane = (globalThis as any).showTaskPane;
           if (!associatedShowTaskPane) throw new Error("showTaskPane function not found");
       }
       await associatedShowTaskPane();
       expect(mockShowAsTaskpane).toHaveBeenCalled();
    });
  });

  describe('insertHelloWorld Command Execution', () => {
     beforeAll(() => {
         // Ensure the function is captured if it wasn't during initial load
         if (!associatedInsertHelloWorld) {
             const call = mockAssociate.mock.calls.find(c => c[0] === 'insertHelloWorld');
             if (call) {
                 associatedInsertHelloWorld = call[1];
             } else {
                 associatedInsertHelloWorld = (globalThis as any).insertHelloWorld;
             }
         }
     });

    it('should call Word.run', async () => {
      if (!associatedInsertHelloWorld) throw new Error("insertHelloWorld function not found");
      await associatedInsertHelloWorld(mockEvent);
      expect(Word.run).toHaveBeenCalled();
    });

    it('should call range.insertText with correct text and location', async () => {
      if (!associatedInsertHelloWorld) throw new Error("insertHelloWorld function not found");
      await associatedInsertHelloWorld(mockEvent);
      expect(mockContextRibbon.document.getSelection).toHaveBeenCalled();
      expect(mockRangeInsertTextRibbon).toHaveBeenCalledWith("Hello World from Ribbon!", Word.InsertLocation.replace);
    });

    it('should call context.sync', async () => {
      if (!associatedInsertHelloWorld) throw new Error("insertHelloWorld function not found");
      await associatedInsertHelloWorld(mockEvent);
      expect(mockSyncRibbon).toHaveBeenCalled();
    });

    it('should call event.completed', async () => {
      if (!associatedInsertHelloWorld) throw new Error("insertHelloWorld function not found");
      await associatedInsertHelloWorld(mockEvent);
      expect(mockEventCompleted).toHaveBeenCalled();
    });

     it('should propagate errors from Word.run and not call event.completed', async () => {
        if (!associatedInsertHelloWorld) throw new Error("insertHelloWorld function not found");
        const mockError = new Error("Word failed");
        (Word.run as jest.Mock).mockImplementationOnce(async () => { throw mockError; });

        await expect(associatedInsertHelloWorld(mockEvent)).rejects.toThrow(mockError);
        expect(mockEventCompleted).not.toHaveBeenCalled();
    });
  });
});