/**
 * @file Generic data processor for analytics tasks.
 * Provides a base for specific processing implementations like stream or batch.
 */

export interface DataProcessorOptions {
  // Define common options for data processors
  source: string;
  destination: string;
}

export abstract class DataProcessor<TInput, TOutput> {
  protected options: DataProcessorOptions;

  constructor(options: DataProcessorOptions) {
    this.options = options;
  }

  /**
   * Abstract method to process data.
   * To be implemented by specific processor types (stream, batch).
   * @param data The input data to process.
   * @returns The processed output data.
   */
  abstract process(data: TInput): Promise<TOutput>;

  /**
   * Validates the input data.
   * @param data The data to validate.
   * @returns True if data is valid, false otherwise.
   */
  protected validateInput(data: TInput): boolean {
    // TODO: Implement generic input validation logic
    console.log('Validating input data:', data);
    return true;
  }

  /**
   * Handles errors during data processing.
   * @param error The error object.
   * @param data The data being processed when the error occurred.
   */
  protected handleError(error: Error, data?: TInput): void {
    console.error('Error during data processing:', error, 'Data:', data);
    // TODO: Implement error handling strategy (e.g., logging, retries, dead-letter queue)
  }

  /**
   * Performs any necessary cleanup after processing.
   */
  public async cleanup(): Promise<void> {
    console.log('Performing cleanup for data processor.');
    // TODO: Implement cleanup logic (e.g., releasing resources)
  }
}