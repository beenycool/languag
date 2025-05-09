# Supported Formats

## Text Format Support
| Format | Extensions | Features |
|--------|------------|----------|
| Plain Text | .txt | Basic validation, encoding detection |
| Markdown | .md, .markdown | AST parsing, frontmatter support |
| JSON | .json | Schema validation, pretty printing |

## Markdown Processing
```typescript
// Example markdown transformation
const processed = await markdownHandler.process({
  content: '# Header\n\nParagraph',
  operations: ['validate', 'toc-generate']
});
```

## HTML Handling
Features:
- Sanitization (HTMLPurify)
- Minification
- Accessibility checks
- DOM manipulation

## Office Format Support
| Format | Extensions | Notes |
|--------|------------|-------|
| DOCX | .docx | Requires OfficeJS |
| XLSX | .xlsx | Read-only support |
| PPTX | .pptx | Basic extraction only |

See implementation: [`src/main/integration/formats/handlers/`](../../src/main/integration/formats/handlers/)