/**
 * @file Generates structured reports from analytical data.
 * Supports various output formats like PDF, HTML, or Markdown.
 */

// For PDF generation, libraries like 'pdfmake', 'puppeteer' (HTML to PDF), or 'jsPDF' could be used.
// For Markdown, simple string templating or a library like 'marked' might be used.

export interface ReportSection {
  type: 'text' | 'chart' | 'table' | 'kpi' | 'customHtml';
  title?: string;
  content?: string; // For text, customHtml (can be Markdown)
  // For chart: requires chart generation capabilities (e.g., from ChartGenerator)
  chartType?: 'bar' | 'line' | 'pie' | 'scatter'; // etc.
  chartData?: any; // Data structure expected by ChartGenerator
  chartOptions?: any; // Options for ChartGenerator
  // For table
  tableData?: Record<string, any>[];
  tableColumns?: { header: string; accessor: string }[];
  // For KPI
  kpiValue?: string | number;
  kpiLabel?: string;
}

export interface ReportConfig {
  title: string;
  author?: string;
  date?: Date | string;
  sections: ReportSection[];
  outputFormat: 'html' | 'pdf' | 'markdown' | 'json'; // JSON for structure
  filename?: string; // Suggested filename for output
  // PDF specific options
  pdfOptions?: {
    pageSize?: string; // 'A4', 'LETTER'
    orientation?: 'portrait' | 'landscape';
    margins?: { top: number; bottom: number; left: number; right: number };
  };
}

export class ReportGenerator {
  // private chartGenerator: ChartGenerator; // If embedding charts as images

  constructor() {
    // this.chartGenerator = new ChartGenerator();
    // For PDF generation with puppeteer:
    // this.browser = await puppeteer.launch();
  }

  /**
   * Generates a report based on the provided configuration.
   * @param config The configuration for the report.
   * @returns A promise that resolves with the report content (string or Buffer) or filepath.
   */
  public async generateReport(config: ReportConfig): Promise<string | Buffer> {
    console.log(`Generating report "${config.title}" in ${config.outputFormat} format.`);

    switch (config.outputFormat) {
      case 'markdown':
        return this.generateMarkdownReport(config);
      case 'html':
        return this.generateHtmlReport(config);
      case 'pdf':
        // PDF generation is more complex and usually involves rendering HTML to PDF
        // or using a direct PDF generation library.
        const htmlForPdf = await this.generateHtmlReport(config, true); // Generate embeddable HTML
        return this.convertHtmlToPdf(htmlForPdf, config.pdfOptions);
      case 'json':
        return JSON.stringify(config, null, 2); // Return the config itself as JSON
      default:
        throw new Error(`Unsupported report output format: ${config.outputFormat}`);
    }
  }

  private async generateMarkdownReport(config: ReportConfig): Promise<string> {
    let md = `# ${config.title}\n\n`;
    if (config.author) md += `**Author:** ${config.author}\n`;
    if (config.date) md += `**Date:** ${config.date instanceof Date ? config.date.toLocaleDateString() : config.date}\n\n`;

    for (const section of config.sections) {
      if (section.title) md += `## ${section.title}\n\n`;
      switch (section.type) {
        case 'text':
          md += `${section.content || ''}\n\n`;
          break;
        case 'chart':
          // Markdown can't directly embed dynamic charts.
          // Could link to an image or provide data summary.
          md += `[Chart: ${section.chartType || 'Untitled Chart'}]\n`;
          md += `*(Chart data would be visualized here. For Markdown, consider embedding an image or a data table.)*\n`;
          if (section.chartData) md += `\`\`\`json\n${JSON.stringify(section.chartData, null, 2)}\n\`\`\`\n\n`;
          break;
        case 'table':
          if (section.tableData && section.tableColumns && section.tableData.length > 0) {
            md += `| ${section.tableColumns.map(col => col.header).join(' | ')} |\n`;
            md += `| ${section.tableColumns.map(() => '---').join(' | ')} |\n`;
            section.tableData.forEach(row => {
              md += `| ${section.tableColumns!.map(col => row[col.accessor] ?? '').join(' | ')} |\n`;
            });
            md += '\n';
          }
          break;
        case 'kpi':
          md += `**${section.kpiLabel || 'KPI'}:** ${section.kpiValue}\n\n`;
          break;
        case 'customHtml': // Treat as text in Markdown
           md += `*(Custom HTML content: ${section.content ? section.content.substring(0,50)+'...' : ''})*\n\n`;
           break;
      }
    }
    return md;
  }

  private async generateHtmlReport(config: ReportConfig, forPdf: boolean = false): Promise<string> {
    let html = `
      <html>
        <head>
          <title>${config.title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; } h2 { color: #555; border-bottom: 1px solid #eee; padding-bottom: 5px; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .kpi { background-color: #f9f9f9; border: 1px solid #eee; padding: 10px; margin-bottom:15px; display:inline-block; }
            .kpi-label { font-weight: bold; }
            /* Basic chart placeholder styling */
            .chart-container { border: 1px solid #ccc; padding: 10px; margin-bottom: 20px; min-height: 200px; text-align: center; color: #777; }
          </style>
        </head>
        <body>
          <h1>${config.title}</h1>`;
    if (config.author) html += `<p><strong>Author:</strong> ${config.author}</p>`;
    if (config.date) html += `<p><strong>Date:</strong> ${config.date instanceof Date ? config.date.toLocaleDateString() : config.date}</p>`;

    for (const section of config.sections) {
      if (section.title) html += `<h2>${section.title}</h2>`;
      switch (section.type) {
        case 'text':
          html += `<p>${section.content || ''}</p>`;
          break;
        case 'chart':
          // For HTML, you'd typically use a JS charting library.
          // If forPdf is true, you might embed an SVG/image generated by ChartGenerator.
          // This placeholder shows where chart would go.
          html += `<div class="chart-container" id="chart-${section.title?.replace(/\s+/g, '-') || Math.random().toString(36).substring(7)}">`;
          html += `Chart: ${section.chartType || 'Untitled Chart'}`;
          if (!forPdf && section.chartData) {
            // Script tag to render chart if a global Chart.js like library is assumed on client
            // html += `<script> new Chart(document.getElementById('chart-${...}'), ${JSON.stringify(chartConfig)}); </script>`;
            html += `<pre>${JSON.stringify({type: section.chartType, data: section.chartData, options: section.chartOptions}, null, 2)}</pre>`;
          }
          html += `</div>`;
          break;
        case 'table':
          if (section.tableData && section.tableColumns && section.tableData.length > 0) {
            html += '<table><thead><tr>';
            section.tableColumns.forEach(col => html += `<th>${col.header}</th>`);
            html += '</tr></thead><tbody>';
            section.tableData.forEach(row => {
              html += '<tr>';
              section.tableColumns!.forEach(col => html += `<td>${row[col.accessor] ?? ''}</td>`);
              html += '</tr>';
            });
            html += '</tbody></table>';
          }
          break;
        case 'kpi':
          html += `<div class="kpi"><span class="kpi-label">${section.kpiLabel || 'KPI'}:</span> ${section.kpiValue}</div>`;
          break;
        case 'customHtml':
          html += section.content || '';
          break;
      }
    }
    html += '</body></html>';
    return html;
  }

  private async convertHtmlToPdf(htmlContent: string, pdfOptions?: ReportConfig['pdfOptions']): Promise<Buffer> {
    // Placeholder for actual HTML to PDF conversion (e.g., using Puppeteer)
    console.log('Converting HTML to PDF (placeholder)...', pdfOptions);
    // Example with Puppeteer:
    // const browser = await puppeteer.launch();
    // const page = await browser.newPage();
    // await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    // const pdfBuffer = await page.pdf({
    //   format: pdfOptions?.pageSize || 'A4',
    //   printBackground: true,
    //   landscape: pdfOptions?.orientation === 'landscape',
    //   margin: pdfOptions?.margins || { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
    // });
    // await browser.close();
    // return pdfBuffer;
    return Buffer.from(`PDF Content for HTML:\n${htmlContent.substring(0, 200)}...`); // Placeholder
  }

  // public async cleanup(): Promise<void> {
  //   // if (this.browser) await this.browser.close();
  // }
}