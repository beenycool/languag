/**
 * @file Performs statistical analysis on datasets.
 * Calculates descriptive statistics, correlations, and hypothesis tests.
 */

// Consider using a library like 'simple-statistics' or 'mathjs' for complex calculations.

export interface StatisticalAnalysisOptions {
  confidenceLevel?: number; // For hypothesis testing, e.g., 0.95 for 95%
}

export class StatisticalAnalyzer {
  private options: StatisticalAnalysisOptions;

  constructor(options: StatisticalAnalysisOptions = {}) {
    this.options = options;
  }

  /**
   * Calculates descriptive statistics for a numeric dataset.
   * @param data An array of numbers.
   * @returns An object containing mean, median, mode, variance, standard deviation, min, max, etc.
   */
  public describe(data: number[]): Record<string, number | number[]> {
    if (!data || data.length === 0) {
      return {
        count: 0,
        mean: NaN, median: NaN, mode: [], variance: NaN, standardDeviation: NaN,
        min: NaN, max: NaN, sum: 0, range: NaN, quartiles: [NaN, NaN, NaN]
      };
    }

    const n = data.length;
    const sortedData = [...data].sort((a, b) => a - b);
    const sum = data.reduce((acc, val) => acc + val, 0);
    const mean = sum / n;

    const median = n % 2 === 0
      ? (sortedData[n / 2 - 1] + sortedData[n / 2]) / 2
      : sortedData[Math.floor(n / 2)];

    const modeMap: Record<number, number> = {};
    let maxFreq = 0;
    data.forEach(num => {
      modeMap[num] = (modeMap[num] || 0) + 1;
      if (modeMap[num] > maxFreq) {
        maxFreq = modeMap[num];
      }
    });
    const mode = Object.keys(modeMap)
                     .filter(key => modeMap[Number(key)] === maxFreq)
                     .map(Number);


    const variance = data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (n > 1 ? n -1 : 1) ; // Sample variance
    const standardDeviation = Math.sqrt(variance);
    const min = sortedData[0];
    const max = sortedData[n - 1];
    const range = max - min;

    const q1 = this.getPercentile(sortedData, 25);
    const q2 = median; // 50th percentile
    const q3 = this.getPercentile(sortedData, 75);

    return {
      count: n,
      sum,
      mean,
      median,
      mode: mode.length === n ? [] : mode, // If all values are unique, technically no mode or all are modes
      variance,
      standardDeviation,
      min,
      max,
      range,
      quartiles: [q1, q2, q3],
      interquartileRange: q3 - q1
    };
  }

  /**
   * Calculates a specific percentile of a sorted numeric dataset.
   * @param sortedData A pre-sorted array of numbers.
   * @param percentile The percentile to calculate (0-100).
   * @returns The value at the given percentile.
   */
  public getPercentile(sortedData: number[], percentile: number): number {
    if (percentile < 0 || percentile > 100 || sortedData.length === 0) return NaN;
    if (percentile === 0) return sortedData[0];
    if (percentile === 100) return sortedData[sortedData.length - 1];

    const index = (percentile / 100) * (sortedData.length - 1);
    if (Number.isInteger(index)) {
      return sortedData[index];
    } else {
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      return sortedData[lower] + (index - lower) * (sortedData[upper] - sortedData[lower]);
    }
  }

  /**
   * Calculates the Pearson correlation coefficient between two numeric datasets.
   * @param dataX Array of numbers for variable X.
   * @param dataY Array of numbers for variable Y.
   * @returns The Pearson correlation coefficient, or NaN if inputs are invalid.
   */
  public pearsonCorrelation(dataX: number[], dataY: number[]): number {
    if (dataX.length !== dataY.length || dataX.length === 0) {
      return NaN;
    }
    const n = dataX.length;
    const meanX = dataX.reduce((s, v) => s + v, 0) / n;
    const meanY = dataY.reduce((s, v) => s + v, 0) / n;

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      numerator += (dataX[i] - meanX) * (dataY[i] - meanY);
      denomX += Math.pow(dataX[i] - meanX, 2);
      denomY += Math.pow(dataY[i] - meanY, 2);
    }

    if (denomX === 0 || denomY === 0) return NaN; // Avoid division by zero if one variable is constant

    return numerator / (Math.sqrt(denomX) * Math.sqrt(denomY));
  }

  // TODO: Implement hypothesis testing (e.g., t-test, chi-squared test)
  // public tTest(sample1: number[], sample2: number[]): { tStatistic: number, pValue: number } {
  //   // Placeholder for t-test logic
  //   // This would typically involve calculating means, variances, and using a t-distribution.
  //   // Libraries like 'simple-statistics' would be helpful here.
  //   console.log('Performing t-test with confidence level:', this.options.confidenceLevel);
  //   return { tStatistic: NaN, pValue: NaN };
  // }
}