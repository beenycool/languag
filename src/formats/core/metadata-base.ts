export abstract class MetadataBase {
  abstract extract(content: unknown): Record<string, unknown>;
  abstract validate(metadata: Record<string, unknown>): boolean;
  abstract normalize(metadata: Record<string, unknown>): Record<string, unknown>;

  protected filterSensitiveFields(
    metadata: Record<string, unknown>
  ): Record<string, unknown> {
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    return Object.fromEntries(
      Object.entries(metadata).filter(
        ([key]) => !sensitiveFields.some(f => key.toLowerCase().includes(f))
      )
    );
  }
}