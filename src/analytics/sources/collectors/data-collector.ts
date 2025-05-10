/**
 * @file Collects data from various configured sources.
 * Orchestrates different connectors (DB, Stream, API) to gather data.
 */

// Assuming connectors are in the same directory or path is adjusted
import { DatabaseConnector, DatabaseConnectionParams } from '../connectors/database-connector';
import { StreamConnector, StreamConnectionParams, StreamDataCallback, StreamErrorCallback } from '../connectors/stream-connector';
import { ApiConnector, ApiConnectionParams } from '../connectors/api-connector';

export type DataSourceConfig =
  | ({ type: 'database'; params: DatabaseConnectionParams; query: string | object })
  | ({ type: 'stream'; params: StreamConnectionParams })
  | ({ type: 'api'; params: ApiConnectionParams; endpoint: string; queryParams?: Record<string, string | number> });

export class DataCollector {
  private sources: DataSourceConfig[];
  private collectedData: Map<string, any[]> = new Map(); // Store data by source identifier

  constructor(sources: DataSourceConfig[]) {
    this.sources = sources;
  }

  /**
   * Collects data from all configured sources.
   * For stream sources, it will initiate listening.
   * @param onStreamData Optional callback for real-time data from streams.
   * @param onStreamError Optional callback for errors from streams.
   * @returns A promise that resolves when initial batch data collection is complete.
   */
  public async collectAll(onStreamData?: StreamDataCallback, onStreamError?: StreamErrorCallback): Promise<void> {
    const collectionPromises = this.sources.map(sourceConfig => {
      const sourceId = this.getSourceId(sourceConfig);
      this.collectedData.set(sourceId, []); // Initialize data store for this source

      switch (sourceConfig.type) {
        case 'database':
          return this.collectFromDatabase(sourceConfig, sourceId);
        case 'api':
          return this.collectFromApi(sourceConfig, sourceId);
        case 'stream':
          return this.startStreamCollection(sourceConfig, sourceId, onStreamData, onStreamError);
        default:
          console.warn(`Unsupported data source type: ${(sourceConfig as any).type}`);
          return Promise.resolve();
      }
    });

    await Promise.all(collectionPromises);
    console.log('Initial data collection complete for batch sources.');
  }

  private getSourceId(config: DataSourceConfig): string {
    // Generate a unique ID for the source, e.g., based on type and endpoint/query
    if (config.type === 'database') return `db-${config.params.databaseName}-${config.query.toString().substring(0, 20)}`;
    if (config.type === 'api') return `api-${config.params.baseUrl.replace(/[^a-zA-Z0-9]/g, '')}-${config.endpoint}`;
    if (config.type === 'stream') return `stream-${config.params.endpoint}-${config.params.topic || 'default'}`;
    return `unknown-source-${Date.now()}`;
  }

  private async collectFromDatabase(config: { params: DatabaseConnectionParams; query: string | object }, sourceId: string): Promise<void> {
    const connector = new DatabaseConnector(config.params);
    try {
      await connector.connect();
      const data = await connector.executeQuery(config.query);
      this.storeData(sourceId, data.data || data); // Adjust based on actual executeQuery response
      console.log(`Collected data from Database: ${sourceId}`);
    } catch (error) {
      console.error(`Error collecting from Database ${sourceId}:`, error);
      this.storeData(sourceId, { error });
    } finally {
      await connector.disconnect();
    }
  }

  private async collectFromApi(config: { params: ApiConnectionParams; endpoint: string; queryParams?: Record<string, string | number> }, sourceId: string): Promise<void> {
    const connector = new ApiConnector(config.params);
    try {
      const data = await connector.get(config.endpoint, config.queryParams);
      this.storeData(sourceId, data);
      console.log(`Collected data from API: ${sourceId}`);
    } catch (error) {
      console.error(`Error collecting from API ${sourceId}:`, error);
      this.storeData(sourceId, { error });
    }
  }

  private async startStreamCollection(
    config: { params: StreamConnectionParams },
    sourceId: string,
    onStreamData?: StreamDataCallback,
    onStreamError?: StreamErrorCallback
  ): Promise<void> {
    const connector = new StreamConnector(config.params);
    const handleData: StreamDataCallback = (data) => {
      this.storeData(sourceId, data, true); // Append stream data
      if (onStreamData) onStreamData(data);
      console.log(`Received stream data from ${sourceId}:`, data);
    };
    const handleError: StreamErrorCallback = (error) => {
      console.error(`Error from stream ${sourceId}:`, error);
      this.storeData(sourceId, { error, timestamp: new Date() }, true);
      if (onStreamError) onStreamError(error);
    };

    try {
      await connector.connect(handleData, handleError);
      console.log(`Stream collection started for: ${sourceId}`);
      // Note: Stream connector will run indefinitely until disconnect is called.
      // For long-running processes, manage connector instances elsewhere.
    } catch (error) {
      console.error(`Failed to start stream collection for ${sourceId}:`, error);
      this.storeData(sourceId, { error });
    }
  }

  private storeData(sourceId: string, data: any, append: boolean = false): void {
    if (!this.collectedData.has(sourceId)) {
      this.collectedData.set(sourceId, []);
    }
    const currentData = this.collectedData.get(sourceId)!;
    if (append) {
      currentData.push(data);
    } else {
      this.collectedData.set(sourceId, Array.isArray(data) ? data : [data]);
    }
  }

  /**
   * Retrieves all collected data.
   * @returns A map of source identifiers to their collected data arrays.
   */
  public getAllData(): Map<string, any[]> {
    return this.collectedData;
  }

  /**
   * Retrieves data for a specific source.
   * @param sourceId The identifier of the data source.
   * @returns An array of collected data for the source, or undefined if not found.
   */
  public getDataBySource(sourceId: string): any[] | undefined {
    return this.collectedData.get(sourceId);
  }
}