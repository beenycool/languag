import { RibbonUi } from '../../ribbon/ribbon-ui';

// Mock Office.js APIs relevant to ribbon UI updates
const mockRequestUpdate = jest.fn();
const mockAssociateRibbonUi = jest.fn(); // Separate associate mock for this file

// Mock the AddinCommands Event object
const mockEventCompletedRibbonUi = jest.fn();
const mockEventRibbonUi: Office.AddinCommands.Event = {
  completed: mockEventCompletedRibbonUi,
  source: { // Required property
      id: "mockControlId" // Example placeholder ID
  } as Office.AddinCommands.Source,
};

// Set up global Office object with necessary mocks
global.Office = {
  ribbon: {
    requestUpdate: mockRequestUpdate,
  },
  // Mock actions for registration testing
  actions: {
      associate: mockAssociateRibbonUi,
  },
  // Add other Office objects if needed by the tested functions
  context: {} as any,
} as any;

// Import/Load the ribbon-ui.ts script to ensure registration happens
// Use isolateModules for clean registration testing
let getButtonEnabledState: (event: Office.AddinCommands.Event) => void;
let getButtonVisibleState: (event: Office.AddinCommands.Event) => void;

const runUiRegistration = () => {
    jest.isolateModules(() => {
        require('../../ribbon/ribbon-ui');
        // Capture functions if testing global fallback
        getButtonEnabledState = (globalThis as any).getButtonEnabledState;
        getButtonVisibleState = (globalThis as any).getButtonVisibleState;
    });
};

// Run initial registration
runUiRegistration();

// Capture associated functions
let associatedGetEnabledState: (event: Office.AddinCommands.Event) => void;
let associatedGetVisibleState: (event: Office.AddinCommands.Event) => void;

const getEnabledCall = mockAssociateRibbonUi.mock.calls.find(c => c[0] === 'getButtonEnabledState');
if (getEnabledCall) {
    associatedGetEnabledState = getEnabledCall[1];
}
const getVisibleCall = mockAssociateRibbonUi.mock.calls.find(c => c[0] === 'getButtonVisibleState');
if (getVisibleCall) {
    associatedGetVisibleState = getVisibleCall[1];
}


describe('RibbonUi', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mocks before each test
    mockAssociateRibbonUi.mockClear();
  });

  describe('Registration', () => {
     beforeEach(() => {
        // Rerun registration in isolation for these tests
        runUiRegistration();
    });

    it('should call Office.actions.associate for GetEnabled/GetVisible callbacks', () => {
      expect(mockAssociateRibbonUi).toHaveBeenCalledWith("getButtonEnabledState", RibbonUi.getButtonEnabledState);
      expect(mockAssociateRibbonUi).toHaveBeenCalledWith("getButtonVisibleState", RibbonUi.getButtonVisibleState);
    });

     it('should assign functions to globalThis if Office.actions.associate is not available', () => {
        const originalActions = (global.Office as any).actions;
        (global.Office as any).actions = undefined; // Simulate missing actions

        jest.isolateModules(() => {
            require('../../ribbon/ribbon-ui');
            expect((globalThis as any).getButtonEnabledState).toBe(RibbonUi.getButtonEnabledState);
            expect((globalThis as any).getButtonVisibleState).toBe(RibbonUi.getButtonVisibleState);
            delete (globalThis as any).getButtonEnabledState;
            delete (globalThis as any).getButtonVisibleState;
        });

        (global.Office as any).actions = originalActions; // Restore
    });
  });


  describe('requestRibbonUpdate', () => {
    it('should call Office.ribbon.requestUpdate with the correct tab structure', () => {
      RibbonUi.requestRibbonUpdate();
      expect(mockRequestUpdate).toHaveBeenCalledWith({
        tabs: [
          {
            id: "TabHome", // Or the custom tab ID used in the function
          }
        ]
      });
    });
  });

  describe('getButtonEnabledState Callback', () => {
     // Use the captured associated function or the global fallback
     const runGetEnabledState = (event: Office.AddinCommands.Event) => {
         const func = associatedGetEnabledState || (globalThis as any).getButtonEnabledState;
         if (!func) throw new Error("getButtonEnabledState function not found");
         func(event);
     };

    it('should call event.completed', () => {
      runGetEnabledState(mockEventRibbonUi);
      expect(mockEventCompletedRibbonUi).toHaveBeenCalled();
    });

    it('should log the control ID (for debugging)', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      runGetEnabledState(mockEventRibbonUi);
      expect(consoleLogSpy).toHaveBeenCalledWith(`GetEnabled callback triggered for control: ${mockEventRibbonUi.source.id}`);
      consoleLogSpy.mockRestore();
    });

    // Add more tests here if getButtonEnabledState implements actual logic
    // e.g., it('should determine enabled state based on selection', () => { ... });
  });

  describe('getButtonVisibleState Callback', () => {
     // Use the captured associated function or the global fallback
     const runGetVisibleState = (event: Office.AddinCommands.Event) => {
         const func = associatedGetVisibleState || (globalThis as any).getButtonVisibleState;
         if (!func) throw new Error("getButtonVisibleState function not found");
         func(event);
     };

    it('should call event.completed', () => {
      runGetVisibleState(mockEventRibbonUi);
      expect(mockEventCompletedRibbonUi).toHaveBeenCalled();
    });

    it('should log the control ID (for debugging)', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      runGetVisibleState(mockEventRibbonUi);
      expect(consoleLogSpy).toHaveBeenCalledWith(`GetVisible callback triggered for control: ${mockEventRibbonUi.source.id}`);
      consoleLogSpy.mockRestore();
    });

    // Add more tests here if getButtonVisibleState implements actual logic
  });
});