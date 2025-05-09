/* global Office, Word */

// This file would typically define functions that are called by ribbon buttons
// defined in the manifest.xml. These functions are usually exposed globally or
// through Office.actions.associate.

// Ensure Office is ready before defining commands that might interact with it.
Office.onReady((info) => {
    if (info.host === Office.HostType.Word) {
        // Example: A function to be called by a ribbon button.
        // In manifest.xml, an Action of type ExecuteFunction would call "showTaskPane" for example.
        // Office.actions.associate("showTaskPaneCommand", showTaskPane);
    }
});

/**
 * Shows the task pane. This function can be called from a ribbon button.
 * Make sure the ID "ButtonId1" matches a TaskpaneId defined in your manifest if you intend to show a specific one.
 * Or, use Office.addin.showAsTaskpane() to show the default taskpane.
 */
async function showTaskPane(): Promise<void> {
    await Office.addin.showAsTaskpane();
    // Alternatively, to show a specific taskpane by ID (if multiple are defined in manifest):
    // Office.context.ui.displayDialogAsync(...); // This is for dialogs, for taskpanes, it's usually via manifest or a single show command.
    // The manifest usually handles which taskpane to show for a button.
    // If you need to programmatically decide which taskpane (HTML file) to show,
    // you might need a more complex setup, possibly involving routing within a single taskpane.html
    // or using dialogs to then trigger specific taskpane views.
}

/**
 * An example action that inserts text at the current selection.
 * This function could be triggered by a custom ribbon button.
 * @param event
 */
async function insertHelloWorld(event: Office.AddinCommands.Event) {
    await Word.run(async (context) => {
        const range = context.document.getSelection();
        range.insertText("Hello World from Ribbon!", Word.InsertLocation.replace);
        await context.sync();
    });
    // IMPORTANT: Call event.completed() after the action is finished.
    event.completed();
}

// To make functions callable from the ribbon (FunctionFile),
// they need to be globally accessible or registered with Office.actions.associate.
// For simplicity, if your manifest calls `FunctionName="insertHelloWorldAction"`, then `insertHelloWorldAction`
// must be a global function.

// (self as any).showTaskPaneCommand = showTaskPane; // One way to make it global for FunctionFile
// (self as any).insertHelloWorldAction = insertHelloWorld; // Make sure names match manifest

// A more modern approach is to use Office.actions.associate in your commands.html (FunctionFile)
// Example (this code would be in commands.html or a JS file loaded by it):
/*
  Office.onReady(() => {
    Office.actions.associate("showTaskPaneCommand", showTaskPane);
    Office.actions.associate("insertHelloWorldAction", insertHelloWorld);
  });
*/

// For this file to be useful, you'd also need a commands.html specified as FunctionFile in manifest.xml,
// and that HTML would load this script.

// Placeholder for global registration if not using Office.actions.associate in a separate FunctionFile html.
// This makes them available if this script itself is the FunctionFile (not recommended for complex add-ins).
if (typeof Office !== "undefined" && typeof Office.actions !== "undefined" && typeof Office.actions.associate !== "undefined") {
    Office.actions.associate("showTaskPane", showTaskPane);
    Office.actions.associate("insertHelloWorld", insertHelloWorld);
} else {
    // Fallback for environments where Office.actions might not be immediately available
    // or if this script is directly referenced in a way that `self` is the global context.
    // This is less robust.
    (globalThis as any).showTaskPane = showTaskPane;
    (globalThis as any).insertHelloWorld = insertHelloWorld;
}