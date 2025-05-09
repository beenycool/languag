# Platform Adapters Guide

## Path Adaptation
```typescript
// From src/platform/utils/adapters/path-adapter.ts
interface PathAdapter {
  normalize(path: string): string;
  toPlatform(path: string): string;
  fromPlatform(path: string): string;
}
```

## Text Encoding
Key features from `src/platform/utils/adapters/encoding-adapter.ts`:
- Cross-platform text encoding/decoding
- BOM detection and handling
- Line ending normalization (CRLF ↔ LF)

## Format Conversion
```typescript
// From src/platform/utils/adapters/format-adapter.ts
interface FormatAdapter {
  convertEOL(content: string, eol: 'lf'|'crlf'): string;
  normalizeEncoding(content: Buffer): Buffer;
}
```

## Platform Quirks
| Platform | Path Case Sensitivity | Line Endings | Encoding Default |
|----------|----------------------|-------------|-----------------|
| Windows  | Insensitive          | CRLF        | UTF-16LE        |
| macOS    | Sensitive            | LF          | UTF-8           |
| Linux    | Sensitive            | LF          | UTF-8           |