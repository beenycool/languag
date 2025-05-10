/**
 * @file Exports generated reports to various destinations.
 * Supports saving reports as files (PDF, HTML, Markdown).
 */

import * as fs from 'fs/promises';
import * as path from 'path';
// Assuming ReportGenerator is in the visualization directory
import { ReportGenerator, ReportConfig } from '../visualization/report-generator';

export interface ReportFileExportOptions {
  destination: 'file';
  filePath: string; // Full path including filename and desired extension (e.g., .pdf, .html, .md)
  // format is derived from filePath extension or specified in ReportConfig
}

// Potentially add other destinations like email, cloud storage in the future
// export interface ReportEmailOptions { ... }

export type ReportExportOptions = ReportFileExportOptions; // | ReportEmailOptions;

export class ReportExporter {
  private reportGenerator: ReportGenerator;

  constructor() {
    this.reportGenerator = new ReportGenerator();
  }

  /**
   * Generates and exports a report based on the provided configurations.
   * @param reportConfig The configuration for the report content and initial format.
   * @param exportOptions Configuration for the export destination.
   * @returns A promise that resolves when the report is exported.
   */
  public async exportReport(reportConfig: ReportConfig, exportOptions: ReportExportOptions): Promise<void> {
    console.log(`Exporting report "${reportConfig.title}"...`);

    if (exportOptions.destination === 'file') {
      // Determine output format from reportConfig or filePath extension
      const fileExtension = path.extname(exportOptions.filePath).toLowerCase().substring(1);
      const formatForGenerator = fileExtension || reportConfig.outputFormat;

      if (!['pdf', 'html', 'markdown', 'json'].includes(formatForGenerator)) {
        throw new Error(`Unsupported file extension or format for report export: ${formatForGenerator}`);
      }

      const finalReportConfig: ReportConfig = {
        ...reportConfig,
        outputFormat: formatForGenerator as 'pdf' | 'html' | 'markdown' | 'json',
      };

      const reportContent = await this.reportGenerator.generateReport(finalReportConfig);

      try {
        await fs.mkdir(path.dirname(exportOptions.filePath), { recursive: true });
        if (reportContent instanceof Buffer) {
          await fs.writeFile(exportOptions.filePath, reportContent);
        } else {
          await fs.writeFile(exportOptions.filePath, reportContent, 'utf-8');
        }
        console.log(`Report successfully exported to: ${exportOptions.filePath}`);
      } catch (error) {
        console.error(`Error exporting report to file ${exportOptions.filePath}:`, error);
        throw error;
      }
    } else {
      throw new Error(`Unsupported report export destination: ${(exportOptions as any).destination}`);
    }
    // await this.reportGenerator.cleanup(); // If ReportGenerator has cleanup like closing a browser
  }
}