# Clipboard I/O Operations

## Reading Operations
```typescript
interface ClipboardReader {
  readText(): Promise<string>;
  readHTML(): Promise<string>;
  readImage(): Promise<Buffer>;
  readFormats(): Promise<string[]>;
}
```

## Writing Operations
```typescript
interface ClipboardWriter {
  writeText(content: string): Promise<void>;
  writeHTML(html: string): Promise<void>;
  writeImage(image: Buffer): Promise<void>;
  clear(): Promise<void>;
}
```

## Format Handling
Supported formats:
1. `text/plain` - Basic text content
2. `text/html` - Rich text with formatting
3. `image/png` - Image data
4. `application/x-custom` - Custom formats

## Error Recovery
1. Retry failed operations (3 attempts)
2. Fallback to simpler formats
3. Log recovery attempts
4. Notify user of persistent failures