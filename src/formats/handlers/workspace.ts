import { FormatBase } from '../core/format-base';
import { FormatHandler } from '../core/format-types';

export class WorkspaceHandler extends FormatBase implements FormatHandler {
  public readonly name: string;
  public readonly extensions: string[];
  public readonly mimeTypes: string[];

  constructor() {
    super('lingualens-workspace', ['.llw'], ['application/lingualens+workspace']);
    this.name = 'lingualens-workspace';
    this.extensions = ['.llw'];
    this.mimeTypes = ['application/lingualens+workspace'];
  }

  validate(content: unknown): boolean {
    try {
      if (typeof content !== 'object' || content === null) return false;
      
      const workspace = content as Record<string, unknown>;
      return typeof workspace.version === 'string' &&
             typeof workspace.name === 'string' &&
             Array.isArray(workspace.projects);
    } catch {
      return false;
    }
  }

  normalize(content: unknown): Record<string, unknown> {
    if (!this.validate(content)) {
      throw new Error('Invalid LinguaLens workspace content');
    }
    return content as Record<string, unknown>;
  }

  getMetadata(content: unknown): Record<string, unknown> {
    if (!this.validate(content)) {
      throw new Error('Invalid LinguaLens workspace content');
    }

    const workspace = content as Record<string, unknown>;
    return {
      version: workspace.version,
      name: workspace.name,
      projectCount: (workspace.projects as Array<unknown>)?.length || 0,
      lastModified: workspace.lastModified || new Date().toISOString()
    };
  }
}