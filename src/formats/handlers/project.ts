import { FormatBase } from '../core/format-base';
import { FormatHandler } from '../core/format-types';

export class ProjectHandler extends FormatBase implements FormatHandler {
  public readonly name: string;
  public readonly extensions: string[];
  public readonly mimeTypes: string[];

  constructor() {
    super('lingualens-project', ['.llp'], ['application/lingualens+project']);
    this.name = 'lingualens-project';
    this.extensions = ['.llp'];
    this.mimeTypes = ['application/lingualens+project'];
  }

  validate(content: unknown): boolean {
    try {
      if (typeof content !== 'object' || content === null) return false;
      
      const project = content as Record<string, unknown>;
      return typeof project.id === 'string' &&
             typeof project.name === 'string' &&
             typeof project.createdAt === 'string' &&
             Array.isArray(project.files);
    } catch {
      return false;
    }
  }

  normalize(content: unknown): Record<string, unknown> {
    if (!this.validate(content)) {
      throw new Error('Invalid LinguaLens project content');
    }
    return content as Record<string, unknown>;
  }

  getMetadata(content: unknown): Record<string, unknown> {
    if (!this.validate(content)) {
      throw new Error('Invalid LinguaLens project content');
    }

    const project = content as Record<string, unknown>;
    return {
      id: project.id,
      name: project.name,
      createdAt: project.createdAt,
      fileCount: (project.files as Array<unknown>)?.length || 0,
      lastModified: project.lastModified || new Date().toISOString()
    };
  }
}