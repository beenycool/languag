export abstract class ConverterBase {
  abstract convert(
    content: unknown,
    fromFormat: string,
    toFormat: string,
    options?: Record<string, unknown>
  ): Promise<unknown>;

  abstract getSupportedFormats(): {
    from: string[];
    to: string[];
  };

  protected validateConversion(
    content: unknown,
    fromFormat: string,
    toFormat: string
  ): boolean {
    const supported = this.getSupportedFormats();
    return (
      supported.from.includes(fromFormat) &&
      supported.to.includes(toFormat) &&
      content !== undefined
    );
  }
}