# Suggestion System

## Architecture Overview
The suggestion system provides real-time writing suggestions by:
1. Analyzing editor content
2. Generating improvement suggestions
3. Displaying actionable items
4. Applying user-selected changes

```typescript
// From src/renderer/components/suggestions/SuggestionList.tsx
interface SuggestionSystemProps {
  analysisResults: AnalysisResult[];
  onApply: (suggestion: Suggestion) => void;
  onIgnore: (suggestion: Suggestion) => void;
}
```

## Core Components

### SuggestionList
- Displays filtered suggestions
- Handles user interactions
- Manages suggestion state

```typescript
// From src/renderer/components/suggestions/SuggestionList.tsx
const SuggestionList: React.FC = () => {
  const suggestions = useSelector(selectFilteredSuggestions);
  const dispatch = useDispatch();

  const handleApply = (suggestion: Suggestion) => {
    dispatch(applySuggestion(suggestion));
    dispatch(dismissSuggestion(suggestion.id));
  };
};
```

### SuggestionItem
- Renders individual suggestions
- Shows suggestion details
- Provides action buttons

```typescript
// From src/renderer/components/suggestions/SuggestionItem.tsx
const SuggestionItem: React.FC<{ suggestion: Suggestion }> = ({ suggestion }) => (
  <li className={`suggestion ${suggestion.type}`}>
    <div className="suggestion-content">
      <h4>{suggestion.title}</h4>
      <p>{suggestion.description}</p>
      <pre>{suggestion.example}</pre>
    </div>
    <div className="suggestion-actions">
      <button onClick={() => onApply(suggestion)}>Apply</button>
      <button onClick={() => onIgnore(suggestion)}>Ignore</button>
    </div>
  </li>
);
```

## Performance Considerations

1. **Virtualized Rendering**
   ```typescript
   <VirtualList
     items={suggestions}
     itemHeight={80}
     renderItem={(suggestion) => (
       <SuggestionItem suggestion={suggestion} />
     )}
   />
   ```

2. **Debounced Analysis**
   ```typescript
   useEffect(() => {
     const timer = setTimeout(() => {
       dispatch(runAnalysis(editorContent));
     }, 500);
     return () => clearTimeout(timer);
   }, [editorContent]);
   ```

3. **Memoized Selectors**
   ```typescript
   export const selectFilteredSuggestions = createSelector(
     [selectAllSuggestions, selectActiveFilters],
     (suggestions, filters) => suggestions.filter(s => 
       filters.includes(s.type)
     )
   );
   ```

## User Interaction Flow
1. User writes content → Analysis triggered
2. Analysis completes → Suggestions generated
3. Suggestions displayed → User selects action
4. Action applied → Editor updates

## Configuration Options
```typescript
interface SuggestionConfig {
  maxSuggestions?: number;
  debounceTime?: number;
  enabledCategories?: SuggestionCategory[];
  confidenceThreshold?: number;
}
```

## Related Components
- [Editor Container](./editor-container.md)
- [UI Components Overview](./overview.md)
- [Worker Architecture](../workers/worker-architecture.md)