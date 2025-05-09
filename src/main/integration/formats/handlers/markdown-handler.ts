/**
 * @file File format handler for Markdown files.
 */
import { FileFormatHandler } from '../core/format-registry';
// import { logger } from '../../../services/logger';

// Assume 'marked' library is available for Markdown parsing.
// In a real project, this would be a dependency: npm install marked @types/marked
import { marked } from 'marked';
import { Buffer } from 'buffer';


export interface MarkdownParseOptions extends marked.MarkedOptions {
  /** If true, returns the token list (AST) instead of HTML string. */
  returnTokens?: boolean;
}

export interface MarkdownSerializeOptions {
  // Options for serializing (e.g. if converting from an AST back to Markdown)
  // For this simple handler, we assume structuredContent is HTML or an AST that marked might not directly re-serialize to MD.
  // A more complex handler might use a Markdown AST stringifier.
  format?: 'html' | 'markdown_ast_string'; // Example
}

export class MarkdownHandler implements FileFormatHandler {
  id = 'markdown';
  name = 'Markdown';
  extensions = ['.md', '.markdown', '.mdown', '.mkdn'];
  mimeTypes = ['text/markdown', 'text/x-markdown'];
  description = 'Handler for Markdown formatted text files.';

  async parse(rawContent: Buffer | string, options?: MarkdownParseOptions): Promise<string | marked.TokensList> {
    // logger.debug(`MarkdownHandler: Parsing content (options: ${JSON.stringify(options)})`);
    console.debug(`MarkdownHandler: Parsing content (options: ${JSON.stringify(options)})`);
    const textContent = Buffer.isBuffer(rawContent) ? rawContent.toString('utf-8') : rawContent;

    try {
      // 'marked.parse' typically returns HTML.
      // If options.returnTokens is true, use marked.lexer to get the AST.
      if (options?.returnTokens) {
        // logger.debug('MarkdownHandler: Returning lexer tokens (AST) as per options.');
        console.debug('MarkdownHandler: Returning lexer tokens (AST) as per options.');
        return marked.lexer(textContent, options);
      }
      // logger.debug('MarkdownHandler: Returning parsed HTML string.');
      console.debug('MarkdownHandler: Returning parsed HTML string.');
      return await marked.parse(textContent, options) as string;
    } catch (error) {
      // logger.error('MarkdownHandler: Error parsing Markdown content.', error);
      console.error('MarkdownHandler: Error parsing Markdown content.', error);
      throw error;
    }
  }

  async serialize(structuredContent: string | marked.TokensList, options?: MarkdownSerializeOptions): Promise<string> {
    // logger.debug(`MarkdownHandler: Serializing content (options: ${JSON.stringify(options)})`);
    console.debug(`MarkdownHandler: Serializing content (options: ${JSON.stringify(options)})`);

    // This is a simplified serialize. If structuredContent is HTML (from parse),
    // and we need to go back to Markdown, it's a complex HTML-to-Markdown conversion.
    // If structuredContent is an AST (TokensList), we'd need a Markdown stringifier.
    // For now, if it's a string, assume it's either Markdown already or HTML to be returned as is.
    if (typeof structuredContent === 'string') {
      return structuredContent;
    }

    // If it's a token list, we would ideally stringify it back to Markdown.
    // `marked` itself doesn't have a direct AST-to-Markdown serializer.
    // A library like 'marked-ast-markdown-renderer' or custom logic would be needed.
    // logger.warn('MarkdownHandler: Serializing from AST (TokensList) to Markdown string is not fully implemented. Returning JSON representation.');
    console.warn('MarkdownHandler: Serializing from AST (TokensList) to Markdown string is not fully implemented. Returning JSON representation.');
    try {
        // Fallback: stringify the AST if no proper serializer is in place.
        return JSON.stringify(structuredContent, null, 2);
    } catch (error) {
        // logger.error('MarkdownHandler: Could not stringify structured content (TokensList).', error);
        console.error('MarkdownHandler: Could not stringify structured content (TokensList).', error);
        throw new Error('Failed to serialize Markdown AST.');
    }
  }

  async extractMetadata(
    content: Buffer | string,
    options?: Record<string, any>
  ): Promise<Record<string, any>> {
    // logger.debug(`MarkdownHandler: Extracting metadata (options: ${JSON.stringify(options)})`);
    console.debug(`MarkdownHandler: Extracting metadata (options: ${JSON.stringify(options)})`);
    const textContent = Buffer.isBuffer(content) ? content.toString('utf-8') : content;
    const metadata: Record<string, any> = {
      lineCount: textContent.split(/\r\n|\r|\n/).length,
      wordCount: textContent.split(/\s+/).filter(Boolean).length,
      characterCount: textContent.length,
    };

    // Basic frontmatter detection (very simplified)
    const frontmatterMatch = textContent.match(/^---\s*([\s\S]*?)\s*---/);
    if (frontmatterMatch && frontmatterMatch[1]) {
      try {
        // A proper YAML parser should be used here (e.g., js-yaml)
        // This is a very naive split for demonstration.
        const fmLines = frontmatterMatch[1].trim().split(/\r\n|\r|\n/);
        const frontmatter: Record<string, string> = {};
        fmLines.forEach(line => {
          const parts = line.split(':');
          if (parts.length >= 2) {
            frontmatter[parts[0].trim()] = parts.slice(1).join(':').trim();
          }
        });
        metadata.frontmatter = frontmatter;
        // logger.info('MarkdownHandler: Extracted frontmatter (simplified).', frontmatter);
        console.info('MarkdownHandler: Extracted frontmatter (simplified).', frontmatter);
      } catch (e) {
        // logger.warn('MarkdownHandler: Could not parse frontmatter (simplified attempt).', e);
        console.warn('MarkdownHandler: Could not parse frontmatter (simplified attempt).', e);
      }
    }
    // logger.info('MarkdownHandler: Metadata extracted.', metadata);
    console.info('MarkdownHandler: Metadata extracted.', metadata);
    return metadata;
  }

  async validate(content: Buffer | string | any): Promise<boolean | string> {
    // logger.debug('MarkdownHandler: Validating content.');
    console.debug('MarkdownHandler: Validating content.');
    const textContent = Buffer.isBuffer(content) ? content.toString('utf-8') : (typeof content === 'string' ? content : '');

    if (!textContent && typeof content !== 'string' && !Buffer.isBuffer(content)) {
        // logger.warn('MarkdownHandler: Content is not a string or buffer, considered invalid.');
        console.warn('MarkdownHandler: Content is not a string or buffer, considered invalid.');
        return 'Content is not a string or buffer.';
    }

    try {
      // Attempt to parse. If it doesn't throw, consider it valid enough.
      // For stricter validation, analyze the token tree for errors.
      marked.lexer(textContent); // Use lexer for a quick syntax check without full parse
      // logger.info('MarkdownHandler: Content appears to be valid Markdown (lexical check).');
      console.info('MarkdownHandler: Content appears to be valid Markdown (lexical check).');
      return true;
    } catch (error: any) {
      // logger.warn('MarkdownHandler: Content validation failed (lexical check).', error.message);
      console.warn('MarkdownHandler: Content validation failed (lexical check).', error.message);
      return error.message || 'Invalid Markdown syntax.';
    }
  }
}