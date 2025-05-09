export class ChunkProcessor {
  static process<T>(items: T[], chunkSize: number, callback: (chunk: T[]) => void): void {
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      callback(chunk);
    }
  }

  static async processAsync<T>(items: T[], chunkSize: number, callback: (chunk: T[]) => Promise<void>): Promise<void> {
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      await callback(chunk);
    }
  }

  static mapChunk<T, R>(items: T[], chunkSize: number, mapper: (item: T) => R): R[] {
    const result: R[] = [];
    this.process(items, chunkSize, chunk => {
      result.push(...chunk.map(mapper));
    });
    return result;
  }

  static async mapChunkAsync<T, R>(items: T[], chunkSize: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
    const result: R[] = [];
    await this.processAsync(items, chunkSize, async chunk => {
      const mapped = await Promise.all(chunk.map(mapper));
      result.push(...mapped);
    });
    return result;
  }
}