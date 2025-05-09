# Word Add-in Architecture Overview

## Component Hierarchy
- **UI Layer** ([`src/addins/word/components/`](src/addins/word/components/))
  - Ribbon UI ([`ribbon-ui.ts`](src/addins/word/components/ribbon/ribbon-ui.ts))
  - Panels ([`suggestion-panel.ts`](src/addins/word/components/panels/suggestion-panel.ts))
- **Integration Layer** ([`src/addins/word/integration/`](src/addins/word/integration/))
  - Document integration ([`content-manager.ts`](src/addins/word/integration/document/content-manager.ts))
  - Analysis integration ([`analysis-bridge.ts`](src/addins/word/integration/analysis/analysis-bridge.ts))
- **Services Layer** ([`src/addins/word/services/`](src/addins/word/services/))
  - Communication ([`app-bridge.ts`](src/addins/word/services/communication/app-bridge.ts))
  - State management ([`addin-state.ts`](src/addins/word/services/state/addin-state.ts))

## Integration Points
1. **Word Host Integration**:
   - Uses Office.js API for document interaction
   - Implements host communication via [`host-bridge.ts`](src/addins/word/services/communication/host-bridge.ts)

2. **Main App Integration**:
   - Communicates via IPC using [`app-bridge.ts`](src/addins/word/services/communication/app-bridge.ts)
   - Shares analysis types from [`src/shared/types/analysis.ts`](src/shared/types/analysis.ts)

## Security Considerations
- All host communication is validated ([`host-bridge.ts:23`](src/addins/word/services/communication/host-bridge.ts:23))
- Content sanitization using [`llm-security.ts`](src/shared/utils/llm-security.ts)
- Secure state synchronization via [`sync-manager.ts`](src/addins/word/services/state/sync-manager.ts)