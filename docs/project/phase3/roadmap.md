# Phase 3 Roadmap

## Feature Priorities
1. **Advanced Format Support**:
   - Office Open XML (DOCX/XLSX/PPTX)
   - Markdown enhancements
   - LaTeX support

2. **Performance Improvements**:
   - Stream processing for large files
   - Memory optimization
   - Parallel conversion pipelines

3. **UI Enhancements**:
   - Real-time preview
   - Batch processing UI
   - Custom templates

## Technical Requirements
- New format handlers ([`src/formats/handlers/`](src/formats/handlers/))
- Enhanced stream processing ([`src/formats/utils/stream-handler.ts`](src/formats/utils/stream-handler.ts))
- UI component updates ([`src/renderer/components/`](src/renderer/components/))

## Integration Needs
| Component | Integration Points | Status |
|-----------|--------------------|--------|
| LLM Service | Analysis pipeline | Planned |
| Clipboard | Advanced paste handling | In Design |
| Shell | New commands | Backlog |

## Resource Estimates
| Area | Dev Weeks | QA Weeks |
|------|----------|---------|
| Format Support | 6 | 2 |
| Performance | 4 | 1 |
| UI | 3 | 1 |

## Timeline Projections
```mermaid
gantt
    title Phase 3 Timeline
    dateFormat  YYYY-MM-DD
    section Core
    Format Handlers      :2025-06-01, 30d
    Performance Work     :2025-06-15, 20d
    section UI
    New Components       :2025-07-01, 14d
    Integration          :2025-07-15, 14d