import { ClipboardContent } from '../../types/clipboard-types';

export class SecurityFilter {
  private dangerousHtmlTags = ['script', 'iframe', 'object', 'embed'];
  private dangerousUriSchemes = ['javascript:', 'data:', 'vbscript:'];

  check(content: ClipboardContent): { 
    safe: boolean;
    warnings: string[];
    sanitizedContent?: ClipboardContent;
  } {
    const result: {
      safe: boolean;
      warnings: string[];
      sanitizedContent?: ClipboardContent;
    } = {
      safe: true,
      warnings: [],
      sanitizedContent: undefined
    };

    if (content.html) {
      const htmlCheck = this.checkHtml(content.html);
      if (!htmlCheck.safe) {
        result.safe = false;
        result.warnings.push(...htmlCheck.warnings);
        result.sanitizedContent = {
          ...content,
          html: htmlCheck.sanitized
        };
      }
    }

    if (content.text) {
      const textCheck = this.checkText(content.text);
      if (!textCheck.safe) {
        result.safe = false;
        result.warnings.push(...textCheck.warnings);
      }
    }

    return result;
  }

  private checkHtml(html: string): { 
    safe: boolean; 
    warnings: string[];
    sanitized: string;
  } {
    const warnings: string[] = [];
    let safe = true;
    let sanitized = html;

    // Check for dangerous tags
    for (const tag of this.dangerousHtmlTags) {
      const regex = new RegExp(`<${tag}[^>]*>.*?</${tag}>`, 'gis');
      if (regex.test(html)) {
        safe = false;
        warnings.push(`Found dangerous HTML tag: ${tag}`);
        sanitized = sanitized.replace(regex, '');
      }
    }

    // Check for dangerous URIs
    for (const scheme of this.dangerousUriSchemes) {
      const regex = new RegExp(`${scheme}[^\\s'"]+`, 'gi');
      if (regex.test(html)) {
        safe = false;
        warnings.push(`Found dangerous URI scheme: ${scheme}`);
        sanitized = sanitized.replace(regex, '#removed');
      }
    }

    return { safe, warnings, sanitized };
  }

  private checkText(text: string): { 
    safe: boolean; 
    warnings: string[];
  } {
    const warnings: string[] = [];
    let safe = true;

    // Check for dangerous URIs in plain text
    for (const scheme of this.dangerousUriSchemes) {
      if (text.includes(scheme)) {
        safe = false;
        warnings.push(`Found dangerous URI scheme in text: ${scheme}`);
      }
    }

    return { safe, warnings };
  }
}