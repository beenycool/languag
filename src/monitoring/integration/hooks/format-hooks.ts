import { MetricCollector } from '../../core/collectors/metric-collector';

// Placeholder types for format handling
type FormatType = 'plaintext' | 'markdown' | 'html' | 'docx';
interface FormatInput { id: string; rawContent: Buffer | string; sourceType: FormatType; }
interface FormatOutput { id: string; convertedContent: string; targetType: FormatType; metadata?: Record<string, any>; }

export class FormatHooks {
  private metricCollector: MetricCollector;

  constructor(metricCollector: MetricCollector) {
    this.metricCollector = metricCollector;
  }

  beforeConversion(input: FormatInput, targetType: FormatType): void {
    const timerName = `format_conversion_${input.sourceType}_to_${targetType}_${input.id}`;
    this.metricCollector.getTimingMetrics().start(timerName);
    const inputSize = typeof input.rawContent === 'string' ? input.rawContent.length : input.rawContent.byteLength;
    this.metricCollector.getPerformanceMetrics().record(`format_input_size_${input.sourceType}_${input.id}`, inputSize, 'bytes');
    console.log(`[Hook] Before format conversion for ID ${input.id}: ${input.sourceType} to ${targetType}`);
  }

  afterConversion(input: FormatInput, output: FormatOutput): void {
    const timerName = `format_conversion_${input.sourceType}_to_${output.targetType}_${input.id}`;
    const timing = this.metricCollector.getTimingMetrics().stop(timerName);
    if (timing) {
      console.log(`[Hook] After format conversion for ID ${input.id}. Time: ${timing.durationMs.toFixed(2)}ms`);
    } else {
      console.warn(`[Hook] Timer ${timerName} was not properly stopped for format conversion ID: ${input.id}`);
    }
    const outputSize = output.convertedContent.length;
    this.metricCollector.getPerformanceMetrics().record(`format_output_size_${output.targetType}_${input.id}`, outputSize, 'characters');
  }

  onConversionError(input: FormatInput, targetType: FormatType, error: any): void {
    const timerName = `format_conversion_${input.sourceType}_to_${targetType}_${input.id}`;
    // Attempt to stop timer if it was started
    if (this.metricCollector.getTimingMetrics()['activeTimers']?.has(timerName)) {
        this.metricCollector.getTimingMetrics().stop(timerName);
        console.warn(`[Hook] Force-stopped timer ${timerName} due to conversion error.`);
    }
    
    this.metricCollector.getPerformanceMetrics().record(`format_conversion_error_${input.sourceType}_to_${targetType}_${input.id}`, 1, 'count');
    console.error(`[Hook] Error during format conversion for ID ${input.id} (${input.sourceType} to ${targetType}):`, error);
  }
}

// Example Usage (conceptual):
/*
const metricCollector = new MetricCollector();
const formatHooks = new FormatHooks(metricCollector);

async function convertDocumentFormat(input: FormatInput, targetType: FormatType): Promise<FormatOutput> {
  formatHooks.beforeConversion(input, targetType);
  let output: FormatOutput;
  try {
    // const converted = await actualConversionFunction(input.rawContent, input.sourceType, targetType);
    // output = { id: input.id, convertedContent: converted, targetType };
    // Forcing an example output
    output = { id: input.id, convertedContent: "example", targetType };
    formatHooks.afterConversion(input, output);
  } catch (e) {
    formatHooks.onConversionError(input, targetType, e);
    throw e; // Re-throw error after hooking
  }
  return output;
}
*/