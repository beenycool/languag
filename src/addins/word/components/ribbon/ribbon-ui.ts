/* global Office */

// This file would contain logic for dynamically updating the ribbon,
// for example, enabling/disabling buttons based on context or add-in state.
// This is an advanced feature and requires careful manifest setup with GetEnabled and GetVisible callbacks.

export class RibbonUi {

    /**
     * Requests the host application to re-render the ribbon.
     * This is useful if the state of custom controls (enabled/disabled, visible/hidden)
     * needs to be updated based on callbacks defined in the manifest.
     */
    public static requestRibbonUpdate(): void {
        Office.ribbon.requestUpdate({
            tabs: [
                {
                    id: "TabHome", // Or your custom tab ID from the manifest
                    // You can specify groups and controls if you need finer-grained updates,
                    // but often just specifying the tab is enough to trigger callbacks.
                }
            ]
        });
    }

    /**
     * Example function that could be called by a GetEnabled callback in the manifest.
     * @param event The event object from the Office host.
     */
    public static getButtonEnabledState(event: Office.AddinCommands.Event): void {
        // Determine if the button should be enabled based on some condition
        // const isEnabled = true; // Replace with actual logic, e.g., check document selection, add-in state
        // The host application (Word) will use the 'isEnabled' variable if your manifest
        // is set up to pass it. For GetEnabled/GetVisible, you typically set a global
        // variable that the host then reads, or the host directly calls a function that returns a boolean.
        // The key is that event.completed() signals the host that your script has finished.
        // For simplicity, we assume the host will re-evaluate.
        // If you need to explicitly tell the host the state, the mechanism depends on the manifest version and host.
        // A common pattern for older manifests was to set a global boolean that the host checks.
        // For newer `EnabledScript` and `VisibleScript`, the function itself should return the boolean state
        // or the manifest should be configured to interpret the result of this function.
        // However, the `event.completed()` is crucial.

        // For the purpose of this callback, Word will re-query the state.
        // If your manifest is set up for <EnabledScript Path="Contoso.GetEnabled" />,
        // then Contoso.GetEnabled should return true/false.
        // This function is the *handler* for that script.
        // The actual logic to determine 'isEnabled' would be here.
        // For now, we just complete the event.
        console.log(`GetEnabled callback triggered for control: ${(event.source as any).id}`);
        // Actual logic to determine 'isEnabled' would go here.
        // For example:
        // Office.context.document.getSelectedDataAsync(Office.CoercionType.Text, (result) => {
        //     if (result.status === Office.AsyncResultStatus.Succeeded) {
        //         const isEnabled = result.value.length > 0;
        //         // How you communicate 'isEnabled' back depends on manifest version.
        //         // For modern add-ins, the function itself might be expected to return a boolean
        //         // or the manifest uses a different mechanism.
        //         // For now, we just complete.
        //         event.completed({allowEvent: isEnabled}); // This is not standard for GetEnabled
        //     } else {
        //         event.completed({allowEvent: false}); // This is not standard for GetEnabled
        //     }
        // });
        // The above is illustrative. The simplest GetEnabled just calls event.completed().
        // The host then uses the function's return value if specified in manifest or other logic.
        // Let's assume the manifest handles getting the boolean state correctly after this event completes.
        event.completed();
    }

     /**
     * Example function that could be called by a GetVisible callback in the manifest.
     * @param event The event object from the Office host.
     */
    public static getButtonVisibleState(event: Office.AddinCommands.Event): void {
        // Similar to GetEnabled, the logic to determine visibility goes here.
        console.log(`GetVisible callback triggered for control: ${(event.source as any).id}`);
        // const isVisible = true; // Actual logic here
        event.completed();
    }
}

// To make these functions callable by the manifest's GetEnabled/GetVisible attributes,
// they need to be globally accessible from the FunctionFile (commands.html).
// Example (in commands.html or a JS file it loads):
/*
  Office.onReady(() => {
    Office.actions.associate("getButtonEnabledStateCallback", RibbonUi.getButtonEnabledState);
    Office.actions.associate("getButtonVisibleStateCallback", RibbonUi.getButtonVisibleState);
  });
*/

// If this script itself is the FunctionFile (not recommended for complex add-ins):
if (typeof Office !== "undefined" && typeof Office.actions !== "undefined" && typeof Office.actions.associate !== "undefined") {
    Office.actions.associate("getButtonEnabledState", RibbonUi.getButtonEnabledState);
    Office.actions.associate("getButtonVisibleState", RibbonUi.getButtonVisibleState);
} else {
    (globalThis as any).getButtonEnabledState = RibbonUi.getButtonEnabledState;
    (globalThis as any).getButtonVisibleState = RibbonUi.getButtonVisibleState;
}

// Note: Dynamic ribbon updates are powerful but add complexity.
// Ensure your manifest.xml is correctly configured with:
// <Control xsi:type="Button" id="MyButton">
//   ...
//   <Action xsi:type="ExecuteFunction">
//     <FunctionName>myButtonAction</FunctionName>
//   </Action>
//   <EnabledScript>
//      <FunctionName>getButtonEnabledStateCallback</FunctionName>
//   </EnabledScript>
//   <VisibleScript>
//      <FunctionName>getButtonVisibleStateCallback</FunctionName>
//   </VisibleScript>
// </Control>
// And your FunctionFile (e.g., commands.html) loads this script and associates the callbacks.