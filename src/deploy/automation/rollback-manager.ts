// Manages rollback handling
// TODO: Implement rollback handling logic

export class RollbackManager {
  private previousVersions: string[];

  constructor() {
    this.previousVersions = [];
  }

  public recordDeployment(version: string): void {
    this.previousVersions.push(version);
    // Optional: Limit the number of stored previous versions
    if (this.previousVersions.length > 10) {
      this.previousVersions.shift();
    }
    console.log(`Deployment of version ${version} recorded.`);
  }

  public getLastVersion(): string | undefined {
    return this.previousVersions[this.previousVersions.length - 1];
  }

  public rollbackToVersion(version: string): void {
    // TODO: Implement actual rollback logic (e.g., redeploying a previous version)
    console.log(`Attempting to roll back to version: ${version}`);
    const versionIndex = this.previousVersions.indexOf(version);
    if (versionIndex > -1) {
      // Simulate rollback
      console.log(`Successfully rolled back to version: ${version}`);
      // Remove versions newer than the rollback target
      this.previousVersions.splice(versionIndex + 1);
    } else {
      console.error(`Version ${version} not found in deployment history. Rollback failed.`);
    }
  }

  public rollbackToPrevious(): void {
    if (this.previousVersions.length > 1) { // Need at least current and one previous
      const currentDeployedVersion = this.previousVersions.pop(); // remove current
      const targetVersion = this.previousVersions[this.previousVersions.length - 1];
      if (targetVersion) {
        console.log(`Rolling back from ${currentDeployedVersion} to ${targetVersion}`);
        this.rollbackToVersion(targetVersion);
      } else {
        console.error('No previous version available to roll back to.');
      }
    } else {
      console.error('No sufficient deployment history to roll back to a previous version.');
    }
  }
}