import { ClipboardContent } from '../../types/clipboard-types';

export class ContentFilter {
  private blockedPatterns: RegExp[] = [];
  private allowedPatterns: RegExp[] = [];

  filter(content: ClipboardContent): {
    passed: boolean;
    filteredContent: ClipboardContent;
    blockedPattern: string | undefined;
  } {
    const result: {
      passed: boolean;
      filteredContent: ClipboardContent;
      blockedPattern: string | undefined;
    } = {
      passed: true,
      filteredContent: { ...content },
      blockedPattern: undefined
    };

    if (!content.text) {
      return result;
    }

    // Check against blocked patterns
    for (const pattern of this.blockedPatterns) {
      if (pattern.test(content.text)) {
        result.passed = false;
        result.blockedPattern = pattern.source;
        return result;
      }
    }

    // Check against allowed patterns (if any are defined)
    if (this.allowedPatterns.length > 0) {
      const anyAllowed = this.allowedPatterns.some(pattern => 
        pattern.test(content.text)
      );
      if (!anyAllowed) {
        result.passed = false;
        return result;
      }
    }

    // Apply content filtering if needed
    if (content.html) {
      result.filteredContent.html = this.sanitizeHtml(content.html);
    }

    return result;
  }

  addBlockedPattern(pattern: RegExp): void {
    this.blockedPatterns.push(pattern);
  }

  addAllowedPattern(pattern: RegExp): void {
    this.allowedPatterns.push(pattern);
  }

  private sanitizeHtml(html: string): string {
    // Basic HTML sanitization - in a real app you'd use a proper sanitizer library
    return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }
}