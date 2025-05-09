# Editor State Management

## Architecture Overview
The editor state management system uses Redux to maintain synchronization between:
- Editor content
- Cursor positions
- UI state
- Analysis results

```typescript
// From src/renderer/state/editor/types.ts
interface EditorState {
  content: string;
  selection: SelectionPosition | null;
  decorations: EditorDecoration[];
  isFocused: boolean;
}
```

## Redux Integration

### Store Configuration
```typescript
// From src/renderer/state/store.ts
import { editorReducer } from './editor/reducer';

const rootReducer = combineReducers({
  editor: editorReducer,
  // ...other reducers
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(/* custom middleware */),
});
```

### State Synchronization
The editor state is synchronized through:

```typescript
// From src/renderer/editor/editor-state.ts
class EditorStateManager {
  private unsubscribe: () => void;

  constructor(private store: Store) {
    this.unsubscribe = store.subscribe(() => {
      const state = store.getState().editor;
      this.applyState(state);
    });
  }

  private applyState(state: EditorState) {
    // Update editor content, decorations, etc.
  }
}
```

## Key Actions

| Action | Description | Source |
|--------|-------------|--------|
| `contentUpdated` | Fired when editor content changes | [editor/actions.ts](../src/renderer/state/editor/actions.ts) |
| `selectionChanged` | Fired when cursor position changes | [editor/actions.ts](../src/renderer/state/editor/actions.ts) |
| `decorationsUpdated` | Updates editor decorations | [editor/actions.ts](../src/renderer/state/editor/actions.ts) |

## Performance Considerations
1. Debounce frequent updates (e.g., cursor movements)
2. Batch decoration updates
3. Use selectors for derived state

```typescript
// From src/renderer/state/editor/selectors.ts
export const selectActiveDecorations = createSelector(
  (state: RootState) => state.editor.decorations,
  (decorations) => decorations.filter(d => d.isActive)
);
```

## Related Components
- [Monaco Integration](./monaco-integration.md)
- [IPC State Sync](../ipc/state-sync-guide.md)