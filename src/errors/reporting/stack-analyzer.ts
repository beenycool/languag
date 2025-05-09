// Analyzes raw stack traces to extract structured information.
// TODO: Improve parsing for different JavaScript engine stack trace formats (V8, SpiderMonkey, JavaScriptCore).
// TODO: Add source map support for mapping minified code locations back to original source.

export interface AnalyzedStackFrame {
  functionName?: string;
  fileName?: string;
  lineNumber?: number;
  columnNumber?: number;
  isNative?: boolean;
  isEval?: boolean;
  rawFrame: string; // The original line from the stack trace
}

export class StackAnalyzer {
  // Basic V8-like stack trace line parser. Example: " at functionName (fileName:lineNumber:columnNumber)"
  // or " at fileName:lineNumber:columnNumber"
  // or " at eval (eval at <anonymous> (fileName:lineNumber:columnNumber), <anonymous>:evalLine:evalColumn)"
  private static readonly V8_STACK_LINE_REGEX =
    /^\s*at (?:(.*?) ?\((?:eval at )?(.+?):(\d+):(\d+)\)|(.+?):(\d+):(\d+)|(eval code|native code))$/;

  // A more generic regex that tries to capture common patterns
  private static readonly GENERIC_STACK_LINE_REGEX =
    /^\s*at (?:([\w$.<>\[\]]+(?: \[as \w+\])?) ?\((.*?):(\d+):(\d+)\)|(.*?):(\d+):(\d+))/;


  constructor() {
    // Initialization, e.g., load source maps if configured
  }

  public parseStack(stackTrace: string): AnalyzedStackFrame[] {
    if (!stackTrace || typeof stackTrace !== 'string') {
      return [];
    }

    const frames: AnalyzedStackFrame[] = [];
    const lines = stackTrace.split('\n');

    for (const line of lines) {
      if (line.trim() === '' || line.toLowerCase().includes('error:')) continue; // Skip empty lines or the error message line itself

      const frame = this.parseLine(line.trim());
      if (frame) {
        frames.push(frame);
      } else {
        // If specific parsers fail, add as a raw unparsed frame
        frames.push({ rawFrame: line.trim() });
      }
    }
    return frames;
  }

  private parseLine(line: string): AnalyzedStackFrame | null {
    // Try V8-like parser first
    let match = line.match(StackAnalyzer.V8_STACK_LINE_REGEX);
    if (match) {
      if (match[8]) { // "eval code" or "native code"
        return {
          functionName: match[8] === 'native code' ? '[native code]' : '[eval]',
          isNative: match[8] === 'native code',
          isEval: match[8] === 'eval code',
          rawFrame: line,
        };
      }
      const functionName = match[1] || undefined;
      const fileName = match[2] || match[5];
      const lineNumber = parseInt(match[3] || match[6], 10);
      const columnNumber = parseInt(match[4] || match[7], 10);

      return {
        functionName: functionName?.trim() || undefined,
        fileName: fileName?.trim(),
        lineNumber: !isNaN(lineNumber) ? lineNumber : undefined,
        columnNumber: !isNaN(columnNumber) ? columnNumber : undefined,
        isEval: !!(functionName?.includes('eval') || fileName?.includes('eval')),
        rawFrame: line,
      };
    }

    // Fallback to a more generic parser
    match = line.match(StackAnalyzer.GENERIC_STACK_LINE_REGEX);
    if (match) {
        const functionName = match[1] || undefined;
        const fileName = match[2] || match[5];
        const lineNumber = parseInt(match[3] || match[6], 10);
        const columnNumber = parseInt(match[4] || match[7], 10);
        return {
            functionName: functionName?.trim() || undefined,
            fileName: fileName?.trim(),
            lineNumber: !isNaN(lineNumber) ? lineNumber : undefined,
            columnNumber: !isNaN(columnNumber) ? columnNumber : undefined,
            isEval: !!(functionName?.includes('eval') || fileName?.includes('eval')),
            rawFrame: line,
        };
    }


    // TODO: Add support for other formats (e.g., Firefox, Safari)
    // For now, if no specific format matches, return null or a raw frame.
    return null;
  }

  // Placeholder for source map lookup
  public async applySourceMaps(frames: AnalyzedStackFrame[]): Promise<AnalyzedStackFrame[]> {
    // TODO: Implement source map loading and application.
    // This would involve fetching source maps (if URLs) or reading them from disk,
    // then using a library like 'source-map' to resolve original positions.
    console.warn('Source map application is not yet implemented in StackAnalyzer.');
    return frames.map(frame => {
      // Simulate lookup
      if (frame.fileName && frame.fileName.includes('.min.js')) {
        // return {
        //   ...frame,
        //   originalFileName: frame.fileName.replace('.min.js', '.js'),
        //   originalLineNumber: frame.lineNumber, // Placeholder
        //   originalColumnNumber: frame.columnNumber, // Placeholder
        // };
      }
      return frame;
    });
  }
}