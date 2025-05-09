# Monaco Editor Integration

## Overview
The Monaco editor integration provides a wrapper around the Monaco editor with enhanced functionality for our specific use cases. Key features include:

- Custom command registration
- Advanced decoration management
- Event handling system
- State synchronization

## Setup and Configuration

```typescript
// From src/renderer/editor/monaco-wrapper.ts
import * as monaco from 'monaco-editor';
import { EditorState } from './editor-state';

export class MonacoWrapper {
  private editor: monaco.editor.IStandaloneCodeEditor;
  private disposables: monaco.IDisposable[] = [];

  constructor(
    container: HTMLElement,
    options: monaco.editor.IStandaloneEditorConstructionOptions
  ) {
    this.editor = monaco.editor.create(container, {
      value: '',
      language: 'markdown',
      theme: 'vs-dark',
      minimap: { enabled: false },
      ...options
    });
  }
}
```

## Event Handling System

The editor implements a comprehensive event system:

```typescript
// From src/renderer/editor/editor-state.ts
interface EditorEvents {
  onContentChange: (content: string) => void;
  onSelectionChange: (selection: monaco.Selection) => void;
  onFocusChange: (focused: boolean) => void;
}

class EditorState {
  private events: EditorEvents;
  
  registerEvents(events: Partial<EditorEvents>) {
    this.events = { ...this.events, ...events };
  }
}
```

## Command Registration

Custom commands can be added through:

```typescript
// From src/renderer/editor/editor-commands.ts
export function registerCustomCommands(
  editor: monaco.editor.IStandaloneCodeEditor,
  commands: Record<string, CommandHandler>
) {
  Object.entries(commands).forEach(([id, handler]) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, handler);
  });
}
```

## Decoration Management

Decorations are managed through:

```typescript
// From src/renderer/editor/editor-decorations.ts
export class DecorationManager {
  private decorationIds: string[] = [];

  applyDecorations(
    editor: monaco.editor.IStandaloneCodeEditor,
    decorations: monaco.editor.IModelDeltaDecoration[]
  ) {
    this.decorationIds = editor.deltaDecorations(
      this.decorationIds,
      decorations
    );
  }
}
```

## Related Components
- [Editor Container](../components/editor-container.md)
- [State Management](./state-management.md)