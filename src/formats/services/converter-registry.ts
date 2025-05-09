import { Converter } from '../core/converter-types';

export class ConverterRegistry {
  private readonly converters: Map<string, Converter[]> = new Map();

  register(converter: Converter): void {
    const supported = converter.getSupportedFormats();
    
    supported.from.forEach(fromFormat => {
      supported.to.forEach(toFormat => {
        const key = this.getConverterKey(fromFormat, toFormat);
        if (!this.converters.has(key)) {
          this.converters.set(key, []);
        }
        this.converters.get(key)?.push(converter);
      });
    });
  }

  getConverter(fromFormat: string, toFormat: string): Converter | undefined {
    const key = this.getConverterKey(fromFormat, toFormat);
    const available = this.converters.get(key);
    return available?.[0]; // Return first registered converter
  }

  getConverters(fromFormat: string, toFormat: string): Converter[] {
    const key = this.getConverterKey(fromFormat, toFormat);
    return this.converters.get(key) || [];
  }

  private getConverterKey(fromFormat: string, toFormat: string): string {
    return `${fromFormat.toLowerCase()}:${toFormat.toLowerCase()}`;
  }
}