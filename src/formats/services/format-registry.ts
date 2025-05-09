import { FormatHandler, FormatRegistration } from '../core/format-types';

export class FormatRegistry {
  private readonly formats: Map<string, FormatHandler> = new Map();
  private readonly extensions: Map<string, FormatHandler> = new Map();
  private readonly mimeTypes: Map<string, FormatHandler> = new Map();

  register(format: FormatRegistration): void {
    if (this.formats.has(format.handler.name)) {
      throw new Error(`Format ${format.handler.name} is already registered`);
    }

    this.formats.set(format.handler.name, format.handler);

    format.handler.extensions.forEach(ext => {
      if (this.extensions.has(ext)) {
        console.warn(`Extension ${ext} is already registered for ${this.extensions.get(ext)?.name}`);
      }
      this.extensions.set(ext, format.handler);
    });

    format.handler.mimeTypes.forEach(mime => {
      if (this.mimeTypes.has(mime)) {
        console.warn(`MIME type ${mime} is already registered for ${this.mimeTypes.get(mime)?.name}`);
      }
      this.mimeTypes.set(mime, format.handler);
    });
  }

  getByName(name: string): FormatHandler | undefined {
    return this.formats.get(name);
  }

  getByExtension(extension: string): FormatHandler | undefined {
    return this.extensions.get(extension.toLowerCase());
  }

  getByMimeType(mimeType: string): FormatHandler | undefined {
    return this.mimeTypes.get(mimeType.toLowerCase());
  }

  listFormats(): FormatHandler[] {
    return Array.from(this.formats.values());
  }
}