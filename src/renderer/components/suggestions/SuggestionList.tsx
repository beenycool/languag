// src/renderer/components/suggestions/SuggestionList.tsx

import React from 'react';
// import { FixedSizeList as List, ListChildComponentProps } from 'react-window'; // For virtualized list
// import AutoSizer from 'react-virtualized-auto-sizer'; // For virtualized list sizing
// import SuggestionItem, { Suggestion } from './SuggestionItem'; // To be created

// Temporary Suggestion type until SuggestionItem is created
export interface Suggestion {
  id: string;
  title: string;
  description: string;
  // Add other properties like type (grammar, style), severity, replacements, etc.
  // e.g., onApply: (suggestionId: string) => void;
  // e.g., onDismiss: (suggestionId: string) => void;
}

interface SuggestionListProps {
  suggestions: Suggestion[];
  onSuggestionClick?: (suggestionId: string) => void;
  // Add other props like isLoading, error, etc.
}

// Placeholder until react-window and SuggestionItem are integrated
const SuggestionList: React.FC<SuggestionListProps> = ({ suggestions, onSuggestionClick }) => {
  if (!suggestions || suggestions.length === 0) {
    return <div style={{ padding: '10px', textAlign: 'center', color: '#888' }}>No suggestions available.</div>;
  }

  return (
    <div className="suggestion-list" data-testid="suggestion-list" style={{ overflowY: 'auto', flexGrow: 1 }}>
      {suggestions.map(suggestion => (
        <div
          key={suggestion.id}
          onClick={() => onSuggestionClick && onSuggestionClick(suggestion.id)}
          style={{
            padding: '10px',
            borderBottom: '1px solid #444',
            cursor: onSuggestionClick ? 'pointer' : 'default',
            backgroundColor: '#333333',
            marginBottom: '5px',
            borderRadius: '3px',
          }}
          className="suggestion-item-placeholder" // For testing or styling
        >
          <h5 style={{ margin: '0 0 5px 0', color: '#E0E0E0' }}>{suggestion.title}</h5>
          <p style={{ margin: 0, fontSize: '0.9em', color: '#B0B0B0' }}>{suggestion.description}</p>
        </div>
      ))}
    </div>
  );
};


/*
// --- Full implementation with react-window (virtualized list) ---
// Uncomment and install react-window and react-virtualized-auto-sizer if needed:
// npm install react-window react-virtualized-auto-sizer
// npm install --save-dev @types/react-window @types/react-virtualized-auto-sizer

const SuggestionList: React.FC<SuggestionListProps> = ({ suggestions, onSuggestionClick }) => {
  if (!suggestions || suggestions.length === 0) {
    return <div style={{ padding: '10px', textAlign: 'center', color: '#888' }}>No suggestions available.</div>;
  }

  const Row = ({ index, style }: ListChildComponentProps) => {
    const suggestion = suggestions[index];
    return (
      <div style={style}>
        <SuggestionItem
          suggestion={suggestion}
          onClick={() => onSuggestionClick && onSuggestionClick(suggestion.id)}
        />
      </div>
    );
  };

  return (
    <div 
      className="suggestion-list-container" 
      style={{ flexGrow: 1, minHeight: 0 }} // Important for AutoSizer
      data-testid="suggestion-list"
    >
      <AutoSizer>
        {({ height, width }) => (
          <List
            height={height}
            itemCount={suggestions.length}
            itemSize={70} // Approximate height of SuggestionItem, adjust as needed
            width={width}
            itemData={suggestions} // Pass suggestions to Row if needed directly
          >
            {Row}
          </List>
        )}
      </AutoSizer>
    </div>
  );
};
*/

export default SuggestionList;