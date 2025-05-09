// src/renderer/components/suggestions/SuggestionItem.tsx

import React from 'react';

export interface SuggestionAction {
  label: string;
  action: () => void;
  type?: 'primary' | 'secondary' | 'danger'; // For styling
}

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  type?: 'grammar' | 'style' | 'clarity' | 'warning' | 'error' | 'info'; // For icon/color coding
  severity?: 'low' | 'medium' | 'high';
  // Example: range in the document to highlight or jump to
  // range?: { startLine: number, startColumn: number, endLine: number, endColumn: number };
  actions?: SuggestionAction[]; // e.g., "Apply Fix", "Ignore"
  // onApply?: () => void; // Specific apply action for this item
  // onDismiss?: () => void; // Specific dismiss action
}

interface SuggestionItemProps {
  suggestion: Suggestion;
  onClick?: (suggestionId: string) => void; // General click on the item
  // onActionClick?: (suggestionId: string, actionLabel: string) => void; // If actions are handled by parent
}

const SuggestionItem: React.FC<SuggestionItemProps> = ({ suggestion, onClick }) => {
  const { id, title, description, type = 'info', actions } = suggestion;

  const getBackgroundColor = () => {
    switch (type) {
      case 'error': return '#5c2222';
      case 'warning': return '#6b4f00';
      case 'style': return '#2a4b6d';
      case 'grammar': return '#3d2a6d';
      case 'clarity': return '#2a6d59';
      case 'info':
      default:
        return '#333333';
    }
  };
  
  const getBorderColor = () => {
     switch (type) {
      case 'error': return '#ff6666';
      case 'warning': return '#ffcc00';
      case 'style': return '#66aaff';
      case 'grammar': return '#aa80ff';
      case 'clarity': return '#66ffcc';
      case 'info':
      default:
        return '#555555';
    }
  }

  return (
    <div
      className={`suggestion-item suggestion-type-${type}`}
      data-testid={`suggestion-item-${id}`}
      onClick={() => onClick && onClick(id)}
      style={{
        padding: '12px',
        marginBottom: '8px',
        borderRadius: '4px',
        backgroundColor: getBackgroundColor(),
        borderLeft: `4px solid ${getBorderColor()}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background-color 0.2s ease',
      }}
      onMouseEnter={(e) => { if(onClick) (e.currentTarget.style.backgroundColor = '#404040');}}
      onMouseLeave={(e) => { if(onClick) (e.currentTarget.style.backgroundColor = getBackgroundColor());}}
    >
      <h5 style={{ margin: '0 0 6px 0', color: '#E0E0E0', fontSize: '1em' }}>
        {/* Can add an icon based on type here */}
        {title}
      </h5>
      <p style={{ margin: '0 0 8px 0', fontSize: '0.9em', color: '#B0B0B0' }}>
        {description}
      </p>
      {actions && actions.length > 0 && (
        <div className="suggestion-actions" style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation(); // Prevent item click if button is clicked
                action.action();
              }}
              className={`suggestion-action-button suggestion-action-${action.type || 'secondary'}`}
              style={{ /* Basic button styling, can be enhanced with CSS classes */
                padding: '4px 8px',
                fontSize: '0.85em',
                borderRadius: '3px',
                border: '1px solid #555',
                cursor: 'pointer',
                backgroundColor: action.type === 'primary' ? '#007acc' : '#444',
                color: 'white',
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SuggestionItem;