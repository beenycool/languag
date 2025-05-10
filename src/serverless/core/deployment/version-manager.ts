interface VersionMetadata {
  timestamp: number;
  config: Record<string, any>;
  codeHash: string;
  dependencies: string[];
}

export class VersionManager {
  private versions = new Map<string, Map<string, VersionMetadata>>();

  createVersion(functionId: string, metadata: Omit<VersionMetadata, 'timestamp'>) {
    const version = Date.now().toString();
    const functionVersions = this.versions.get(functionId) || new Map();
    
    functionVersions.set(version, {
      ...metadata,
      timestamp: Date.now()
    });
    
    this.versions.set(functionId, functionVersions);
    return version;
  }

  getVersion(functionId: string, version: string) {
    return this.versions.get(functionId)?.get(version);
  }

  listVersions(functionId: string) {
    return Array.from(this.versions.get(functionId)?.entries() || []);
  }
}