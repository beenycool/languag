// src/renderer/editor/editor-commands.ts

import * as monaco from 'monaco-editor';
import { MonacoEditorWrapper } from './monaco-wrapper'; // Assuming monaco-wrapper.ts is in the same directory

export interface EditorCommand {
  id: string;
  label?: string;
  keybindings?: monaco.KeyCode[];
  contextMenuGroupId?: string;
  contextMenuOrder?: number;
  run: (editor: monaco.editor.IStandaloneCodeEditor, ...args: any[]) => void | Promise<void>;
}

/**
 * Manages the registration of commands for the Monaco Editor.
 */
export class EditorCommandRegistry {
  private editorWrapper: MonacoEditorWrapper;
  private registeredCommands: Map<string, monaco.IDisposable> = new Map();

  constructor(editorWrapper: MonacoEditorWrapper) {
    this.editorWrapper = editorWrapper;
  }

  /**
   * Registers a new command with the editor.
   * @param command - The command to register.
   * @returns True if registration was successful, false otherwise.
   */
  public registerCommand(command: EditorCommand): boolean {
    const editor = this.editorWrapper.getEditor();
    if (!editor) {
      console.error('EditorCommandRegistry: Editor not initialized. Cannot register command:', command.id);
      return false;
    }

    if (this.registeredCommands.has(command.id)) {
      console.warn(`EditorCommandRegistry: Command with id "${command.id}" is already registered. Overwriting.`);
      this.unregisterCommand(command.id);
    }

    const disposable = editor.addAction({
      id: command.id,
      label: command.label || command.id,
      keybindings: command.keybindings,
      contextMenuGroupId: command.contextMenuGroupId,
      contextMenuOrder: command.contextMenuOrder,
      run: (ed, ...args) => command.run(ed as monaco.editor.IStandaloneCodeEditor, ...args),
    });

    this.registeredCommands.set(command.id, disposable);
    console.log(`EditorCommandRegistry: Command "${command.id}" registered.`);
    return true;
  }

  /**
   * Registers multiple commands.
   * @param commands - An array of commands to register.
   */
  public registerCommands(commands: EditorCommand[]): void {
    commands.forEach(cmd => this.registerCommand(cmd));
  }

  /**
   * Unregisters a command by its ID.
   * @param commandId - The ID of the command to unregister.
   * @returns True if unregistration was successful, false otherwise.
   */
  public unregisterCommand(commandId: string): boolean {
    const disposable = this.registeredCommands.get(commandId);
    if (disposable) {
      disposable.dispose();
      this.registeredCommands.delete(commandId);
      console.log(`EditorCommandRegistry: Command "${commandId}" unregistered.`);
      return true;
    }
    console.warn(`EditorCommandRegistry: Command with id "${commandId}" not found for unregistration.`);
    return false;
  }

  /**
   * Unregisters all currently registered commands.
   */
  public unregisterAllCommands(): void {
    this.registeredCommands.forEach((disposable, commandId) => {
      disposable.dispose();
      console.log(`EditorCommandRegistry: Command "${commandId}" unregistered during unregisterAll.`);
    });
    this.registeredCommands.clear();
  }

  /**
   * Disposes of the command registry and unregisters all commands.
   * Should be called when the editor is disposed.
   */
  public dispose(): void {
    this.unregisterAllCommands();
  }
}

// Example Usage (typically you'd instantiate this where you manage your editor instance)
//
// import MonacoEditorWrapper from './monaco-wrapper';
//
// const editorElement = document.getElementById('editor-container');
// if (editorElement) {
//   const wrapper = new MonacoEditorWrapper();
//   const editor = wrapper.createEditor(editorElement);
//
//   const commandRegistry = new EditorCommandRegistry(wrapper);
//
//   commandRegistry.registerCommand({
//     id: 'my.custom.command',
//     label: 'Execute My Custom Logic',
//     keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK],
//     run: (ed) => {
//       alert('Custom command executed! Current content: ' + ed.getValue());
//     }
//   });
// }