# UI Style Guide

## CSS Organization
- **Main Styles**: `src/renderer/styles/main.css`
- **Component Styles**: Co-located with components
- **Variables**: CSS custom properties for theming

## Component Styling
1. **Layout Principles**:
   - Use CSS Grid for main layouts
   - Flexbox for component-level layouts
   - Consistent spacing variables

2. **Theming**:
```css
:root {
  --primary-color: #4285f4;
  --text-color: #202124;
}

[data-theme="dark"] {
  --primary-color: #8ab4f8;
  --text-color: #e8eaed;
}
```

## Best Practices
1. **BEM Naming**: `block__element--modifier`
2. **Mobile First**: Base styles for mobile, media queries for larger screens
3. **Performance**: Avoid expensive CSS properties in animations

## Example Component
```css
.settings-panel {
  display: grid;
  gap: var(--spacing-md);
}

.settings-panel__header {
  font-size: 1.2rem;
  color: var(--text-color);
}