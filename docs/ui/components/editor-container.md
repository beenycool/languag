# Editor Container Component

## Architecture
The EditorContainer serves as the main wrapper for the Monaco editor and coordinates:
- Editor initialization
- State synchronization
- Child component composition

```typescript
// From src/renderer/components/app/EditorContainer.tsx
interface EditorContainerProps {
  initialContent?: string;
  onReady?: (editor: MonacoWrapper) => void;
}

export const EditorContainer: React.FC<EditorContainerProps> = ({
  initialContent,
  onReady
}) => {
  const [editor, setEditor] = useState<MonacoWrapper | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && !editor) {
      const wrapper = new MonacoWrapper(containerRef.current, {
        value: initialContent || ''
      });
      setEditor(wrapper);
      onReady?.(wrapper);
    }
  }, [containerRef, editor, initialContent, onReady]);

  return (
    <div className="editor-container">
      <div ref={containerRef} className="editor-wrapper" />
      <SuggestionList />
      <AnalysisControls />
    </div>
  );
};
```

## Key Responsibilities
1. **Editor Lifecycle Management**
   - Mounting/unmounting
   - Configuration
   - Cleanup

2. **State Synchronization**
   - Content updates
   - Selection changes
   - Decoration updates

3. **Child Component Coordination**
   - Suggestion display
   - Analysis controls
   - Status updates

## Integration Points
| Integration | Description | Source File |
|-------------|-------------|-------------|
| Monaco Editor | Wrapped editor instance | [monaco-wrapper.ts](../src/renderer/editor/monaco-wrapper.ts) |
| Redux Store | State management | [store.ts](../src/renderer/state/store.ts) |
| Suggestion System | Displays suggestions | [SuggestionList.tsx](../src/renderer/components/suggestions/SuggestionList.tsx) |
| Analysis Controls | User interaction | [AnalysisControls.tsx](../src/renderer/components/suggestions/AnalysisControls.tsx) |

## Configuration Options
```typescript
interface EditorConfig {
  language?: string;
  theme?: string;
  fontSize?: number;
  lineNumbers?: 'on' | 'off';
  minimap?: { enabled: boolean };
  readOnly?: boolean;
}
```

## Performance Considerations
1. **Debounce Content Updates**
   ```typescript
   const handleContentChange = useMemo(
     () => debounce((content: string) => {
       dispatch(editorActions.contentUpdated(content));
     }, 300),
     [dispatch]
   );
   ```

2. **Memoize Child Components**
   ```typescript
   const MemoizedSuggestionList = React.memo(SuggestionList);
   ```

3. **Cleanup Resources**
   ```typescript
   useEffect(() => {
     return () => {
       editor?.dispose();
     };
   }, [editor]);
   ```

## Related Components
- [UI Components Overview](./overview.md)
- [Suggestion System](./suggestion-system.md)
- [State Management](../editor/state-management.md)