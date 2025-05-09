// src/renderer/components/app/SidePanel.tsx

import React from 'react';
// import SuggestionList from '../suggestions/SuggestionList'; // To be created
// import AnalysisControls from '../suggestions/AnalysisControls'; // To be created

interface SidePanelProps {
  // Props to control visibility, content, etc.
  isVisible?: boolean;
}

const SidePanel: React.FC<SidePanelProps> = ({ isVisible = true }) => {
  if (!isVisible) {
    return null;
  }

  // Placeholder content until SuggestionList and AnalysisControls are implemented
  const placeholderSuggestions = [
    { id: '1', title: 'Suggestion 1', description: 'Consider rephrasing this sentence for clarity.' },
    { id: '2', title: 'Suggestion 2', description: 'Potential grammar error found here.' },
    { id: '3', title: 'Suggestion 3', description: 'This word might be too informal for the context.' },
  ];

  return (
    <div
      className="side-panel"
      style={{
        width: '300px', // Example width
        height: '100%',
        borderLeft: '1px solid #333333',
        backgroundColor: '#2D2D2D', // Darker background
        color: '#cccccc',
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
      data-testid="side-panel"
    >
      <h3 style={{ marginTop: 0, marginBottom: '15px', borderBottom: '1px solid #444', paddingBottom: '10px' }}>
        Suggestions
      </h3>
      
      {/* <AnalysisControls /> */} {/* Placeholder */}
      <div style={{ marginBottom: '15px', padding: '10px', border: '1px dashed #555', borderRadius: '4px' }}>
        Analysis Controls (Placeholder)
      </div>

      {/* <SuggestionList suggestions={placeholderSuggestions} /> */} {/* Placeholder */}
      <div className="suggestion-list-placeholder" style={{ flexGrow: 1 }}>
        <h4 style={{marginTop: 0}}>Suggestion List (Placeholder)</h4>
        {placeholderSuggestions.map(suggestion => (
          <div 
            key={suggestion.id} 
            style={{ 
              padding: '8px', 
              border: '1px solid #444', 
              borderRadius: '4px', 
              marginBottom: '8px',
              backgroundColor: '#333333'
            }}
          >
            <h5 style={{ margin: '0 0 5px 0' }}>{suggestion.title}</h5>
            <p style={{ margin: 0, fontSize: '0.9em' }}>{suggestion.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SidePanel;