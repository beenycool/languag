export interface ConversionOptions {
  quality?: number;
  encoding?: string;
  metadata?: 'preserve' | 'strip' | 'normalize';
  [key: string]: unknown;
}

export interface Converter {
  convert(
    content: unknown,
    fromFormat: string,
    toFormat: string,
    options?: ConversionOptions
  ): Promise<unknown>;

  getSupportedFormats(): {
    from: string[];
    to: string[];
  };
}

export interface ConversionResult {
  content: unknown;
  metadata?: Record<string, unknown>;
  warnings?: string[];
}