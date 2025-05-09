export class ContentSanitizer {
  static sanitizeText(content: string): string {
    // Remove null bytes and control characters (except newlines and tabs)
    return content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  }

  static sanitizeHtml(html: string): string {
    // Basic HTML sanitization - remove script tags and dangerous attributes
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/ on\w+="[^"]*"/g, '')
      .replace(/ on\w+='[^']*'/g, '')
      .replace(/<iframe\b[^>]*>.*?<\/iframe>/gi, '');
  }

  static sanitizeJson(json: string): string {
    // Remove potential JSONP callback wrapper
    return json.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
  }

  static sanitizeBuffer(buffer: Uint8Array): Uint8Array {
    // For binary formats, we can't sanitize content but can validate size
    if (buffer.length > 100 * 1024 * 1024) { // 100MB max
      throw new Error('File size exceeds maximum allowed limit');
    }
    return buffer;
  }
}