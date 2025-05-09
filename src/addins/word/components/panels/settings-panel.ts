// This class would be responsible for rendering and managing add-in settings
// within the task pane. It would interact with a state management solution
// (like AddinState) to load and save settings.

interface AddinSetting {
    id: string;
    label: string;
    type: 'boolean' | 'string' | 'number' | 'choice';
    currentValue: any;
    choices?: string[]; // For 'choice' type
    description?: string;
}

// Placeholder for where settings are stored/managed
interface SettingsProvider {
    getSetting(key: string): Promise<any>;
    setSetting(key: string, value: any): Promise<void>;
    getAllSettings(): Promise<AddinSetting[]>; // Method to fetch all defined settings
}

export class SettingsPanel {
    private panelElement: HTMLElement;
    private settingsProvider: SettingsProvider;

    /**
     * Initializes the settings panel.
     * @param containerElement The HTML element in the task pane where settings will be rendered.
     * @param provider An object that handles fetching and saving settings.
     */
    constructor(containerElement: HTMLElement, provider: SettingsProvider) {
        if (!containerElement) {
            throw new Error("SettingsPanel: Container element not provided.");
        }
        if (!provider) {
            throw new Error("SettingsPanel: Settings provider not provided.");
        }
        this.panelElement = containerElement;
        this.settingsProvider = provider;

        this.panelElement.innerHTML = ""; // Clear existing content
        const header = document.createElement("h3");
        header.textContent = "Add-in Settings";
        this.panelElement.appendChild(header);
    }

    /**
     * Loads and renders all settings.
     */
    public async loadAndRenderSettings(): Promise<void> {
        // Clear previous settings, but keep the header
        while (this.panelElement.children.length > 1) {
            this.panelElement.removeChild(this.panelElement.lastChild!);
        }

        try {
            const settings = await this.settingsProvider.getAllSettings();
            if (settings.length === 0) {
                const noSettingsMessage = document.createElement("p");
                noSettingsMessage.textContent = "No configurable settings available.";
                this.panelElement.appendChild(noSettingsMessage);
                return;
            }

            const settingsList = document.createElement("div");
            settingsList.className = "settings-list";

            settings.forEach(setting => {
                const settingItem = this.createSettingInput(setting);
                settingsList.appendChild(settingItem);
            });

            this.panelElement.appendChild(settingsList);

        } catch (error) {
            console.error("Error loading settings:", error);
            const errorMessage = document.createElement("p");
            errorMessage.textContent = "Could not load settings.";
            errorMessage.style.color = "red";
            this.panelElement.appendChild(errorMessage);
        }
    }

    private createSettingInput(setting: AddinSetting): HTMLElement {
        const itemDiv = document.createElement("div");
        itemDiv.className = "setting-item";

        const label = document.createElement("label");
        label.htmlFor = `setting-${setting.id}`;
        label.textContent = setting.label;
        itemDiv.appendChild(label);

        if (setting.description) {
            const description = document.createElement("p");
            description.className = "setting-description";
            description.textContent = setting.description;
            itemDiv.appendChild(description);
        }

        let inputElement: HTMLElement;

        switch (setting.type) {
            case 'boolean':
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.checked = !!setting.currentValue;
                checkbox.onchange = () => this.settingsProvider.setSetting(setting.id, checkbox.checked);
                inputElement = checkbox;
                break;
            case 'string':
                const textInput = document.createElement("input");
                textInput.type = "text";
                textInput.value = setting.currentValue as string || "";
                textInput.onchange = () => this.settingsProvider.setSetting(setting.id, textInput.value);
                inputElement = textInput;
                break;
            case 'number':
                const numInput = document.createElement("input");
                numInput.type = "number";
                numInput.value = (setting.currentValue as number | undefined)?.toString() || "0";
                numInput.onchange = () => this.settingsProvider.setSetting(setting.id, parseFloat(numInput.value));
                inputElement = numInput;
                break;
            case 'choice':
                const select = document.createElement("select");
                (setting.choices || []).forEach(choice => {
                    const option = document.createElement("option");
                    option.value = choice;
                    option.textContent = choice;
                    if (choice === setting.currentValue) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });
                select.onchange = () => this.settingsProvider.setSetting(setting.id, select.value);
                inputElement = select;
                break;
            default:
                const span = document.createElement("span");
                span.textContent = `Unsupported setting type: ${setting.type}`;
                inputElement = span;
        }
        inputElement.id = `setting-${setting.id}`;
        itemDiv.appendChild(inputElement);
        return itemDiv;
    }

    /**
     * Clears the settings panel.
     */
    public clear(): void {
         while (this.panelElement.children.length > 1) {
            this.panelElement.removeChild(this.panelElement.lastChild!);
        }
        const clearedMessage = document.createElement("p");
        clearedMessage.textContent = "Settings cleared.";
        this.panelElement.appendChild(clearedMessage);
    }
}

// Example CSS (to be added to a .css file):
/*
.settings-list {
    margin-top: 10px;
}

.setting-item {
    margin-bottom: 15px;
    padding: 10px;
    border: 1px solid #eee;
    background-color: #fdfdfd;
}

.setting-item label {
    font-weight: bold;
    display: block;
    margin-bottom: 5px;
}

.setting-item input[type="text"],
.setting-item input[type="number"],
.setting-item select {
    width: calc(100% - 12px);
    padding: 5px;
    margin-top: 3px;
}

.setting-description {
    font-size: 0.85em;
    color: #555;
    margin-bottom: 5px;
}
*/