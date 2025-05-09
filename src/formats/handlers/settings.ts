import { FormatBase } from '../core/format-base';
import { FormatHandler } from '../core/format-types';

export class SettingsHandler extends FormatBase implements FormatHandler {
  public readonly name: string;
  public readonly extensions: string[];
  public readonly mimeTypes: string[];

  constructor() {
    super('lingualens-settings', ['.lls'], ['application/lingualens+settings']);
    this.name = 'lingualens-settings';
    this.extensions = ['.lls'];
    this.mimeTypes = ['application/lingualens+settings'];
  }

  validate(content: unknown): boolean {
    try {
      if (typeof content !== 'object' || content === null) return false;
      
      const settings = content as Record<string, unknown>;
      return typeof settings.version === 'string' &&
             typeof settings.userId === 'string' &&
             typeof settings.preferences === 'object';
    } catch {
      return false;
    }
  }

  normalize(content: unknown): Record<string, unknown> {
    if (!this.validate(content)) {
      throw new Error('Invalid LinguaLens settings content');
    }
    return content as Record<string, unknown>;
  }

  getMetadata(content: unknown): Record<string, unknown> {
    if (!this.validate(content)) {
      throw new Error('Invalid LinguaLens settings content');
    }

    const settings = content as Record<string, unknown>;
    return {
      version: settings.version,
      userId: settings.userId,
      lastModified: settings.lastModified || new Date().toISOString(),
      preferenceCount: Object.keys(settings.preferences as object).length
    };
  }
}