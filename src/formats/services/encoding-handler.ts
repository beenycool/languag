export class EncodingHandler {
  private static textDecoder = new TextDecoder();
  private static textEncoder = new TextEncoder();

  static decode(buffer: Uint8Array, encoding = 'utf-8'): string {
    try {
      return this.textDecoder.decode(buffer);
    } catch (error) {
      throw new Error(`Failed to decode content: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  static encode(text: string, encoding = 'utf-8'): Uint8Array {
    try {
      return this.textEncoder.encode(text);
    } catch (error) {
      throw new Error(`Failed to encode content: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  static detectEncoding(buffer: Uint8Array): string {
    // Simple UTF-8 BOM detection
    if (buffer.length >= 3 && 
        buffer[0] === 0xEF && 
        buffer[1] === 0xBB && 
        buffer[2] === 0xBF) {
      return 'utf-8';
    }
    // Default to utf-8
    return 'utf-8';
  }

  static normalizeEncoding(encoding: string): string {
    return encoding.toLowerCase().replace(/[^a-z0-9]/g, '');
  }
}