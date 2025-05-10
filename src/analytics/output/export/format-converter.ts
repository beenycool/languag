/**
 * @file Converts data between various formats (e.g., JSON to CSV, XML to JSON).
 * Useful for transforming data before export or for interoperability.
 */

// For XML parsing/building, a library like 'xml2js' or 'fast-xml-parser' might be used.

export type SupportedFormat = 'json' | 'csv' | 'xml' | 'yaml' | 'plaintext';

export interface ConversionOptions {
  // CSV specific
  csvDelimiter?: string;
  csvHeaders?: string[]; // To specify order or subset of headers for CSV output
  // XML specific
  xmlRootTag?: string;
  xmlItemTag?: string;
  // YAML specific (if using a library like 'js-yaml')
  yamlIndent?: number;
}

export class FormatConverter {
  constructor() {}

  /**
   * Converts data from one supported format to another.
   * @param inputData The data to convert (as a string or an object array for some inputs).
   * @param fromFormat The current format of the input data.
   * @param toFormat The target format for conversion.
   * @param options Additional options for the conversion process.
   * @returns A promise that resolves with the converted data as a string.
   */
  public async convert(
    inputData: string | Record<string, any>[],
    fromFormat: SupportedFormat,
    toFormat: SupportedFormat,
    options: ConversionOptions = {}
  ): Promise<string> {
    console.log(`Converting data from ${fromFormat} to ${toFormat}...`);

    if (fromFormat === toFormat) {
      return typeof inputData === 'string' ? inputData : JSON.stringify(inputData); // Or handle appropriately
    }

    let intermediateJson: Record<string, any>[];

    // Step 1: Parse input to a common intermediate format (JSON object/array)
    if (typeof inputData === 'string') {
      switch (fromFormat) {
        case 'json':
          intermediateJson = JSON.parse(inputData);
          break;
        case 'csv':
          intermediateJson = this.parseCsv(inputData, options.csvDelimiter);
          break;
        case 'xml':
          intermediateJson = await this.parseXml(inputData); // XML parsing can be async
          break;
        case 'yaml':
          intermediateJson = await this.parseYaml(inputData); // YAML parsing can be async
          break;
        case 'plaintext': // Assuming plaintext is line-separated JSON or simple lines
          intermediateJson = inputData.split('\n').map(line => {
            try { return JSON.parse(line); } catch { return { text: line }; }
          });
          break;
        default:
          throw new Error(`Unsupported input format for conversion: ${fromFormat}`);
      }
    } else { // Input is already Record<string, any>[]
        if (fromFormat !== 'json' && fromFormat !== 'plaintext') { // 'plaintext' could be pre-parsed objects
            console.warn(`Input data is object array, but fromFormat is ${fromFormat}. Assuming it's effectively JSON.`);
        }
      intermediateJson = inputData;
    }
    
    if (!Array.isArray(intermediateJson)) { // Ensure it's an array for consistent processing
        intermediateJson = [intermediateJson];
    }


    // Step 2: Convert from intermediate JSON to the target format
    switch (toFormat) {
      case 'json':
        return JSON.stringify(intermediateJson, null, options.yamlIndent); // yamlIndent can be used for pretty print
      case 'csv':
        return this.convertJsonToCsv(intermediateJson, options.csvDelimiter, options.csvHeaders);
      case 'xml':
        return this.convertJsonToXml(intermediateJson, options.xmlRootTag, options.xmlItemTag);
      case 'yaml':
        return await this.convertJsonToYaml(intermediateJson, options.yamlIndent);
      case 'plaintext':
        return intermediateJson.map(item => typeof item === 'object' ? JSON.stringify(item) : String(item)).join('\n');
      default:
        throw new Error(`Unsupported output format for conversion: ${toFormat}`);
    }
  }

  private parseCsv(csvString: string, delimiter: string = ','): Record<string, any>[] {
    const lines = csvString.trim().split('\n');
    if (lines.length === 0) return [];

    const headers = lines[0].split(delimiter).map(h => h.trim());
    const records: Record<string, any>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter); // Basic split, doesn't handle quoted delimiters
      const record: Record<string, any> = {};
      headers.forEach((header, index) => {
        record[header] = values[index] ? values[index].trim() : '';
      });
      records.push(record);
    }
    return records;
  }

  private convertJsonToCsv(jsonData: Record<string, any>[], delimiter: string = ',', headersOrder?: string[]): string {
    if (jsonData.length === 0) return '';
    const headers = headersOrder || Object.keys(jsonData[0]);
    const headerRow = headers.join(delimiter);
    const dataRows = jsonData.map(row =>
      headers.map(header => {
        let value = row[header];
        if (value === null || value === undefined) value = '';
        if (typeof value === 'string' && (value.includes(delimiter) || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(delimiter)
    );
    return [headerRow, ...dataRows].join('\n');
  }

  private async parseXml(xmlString: string): Promise<Record<string, any>[]> {
    // Placeholder: Use a library like 'xml2js'
    // import { parseStringPromise } from 'xml2js';
    // try {
    //   const result = await parseStringPromise(xmlString, { explicitArray: false, trim: true });
    //   // Result structure depends on XML and xml2js options. Adapt as needed.
    //   // Often the root will contain an array of items.
    //   const rootKey = Object.keys(result)[0];
    //   const items = result[rootKey].item || result[rootKey]; // Assuming 'item' or direct array
    //   return Array.isArray(items) ? items : [items];
    // } catch (error) {
    //   console.error('XML parsing error:', error);
    //   throw error;
    // }
    console.warn('XML parsing is a placeholder. Returning mock data.');
    return [{ parsed_xml_field: 'value', original_xml: xmlString.substring(0, 50) + '...' }];
  }

  private convertJsonToXml(jsonData: Record<string, any>[], rootTag: string = 'root', itemTag?: string): string {
    const actualItemTag = itemTag || (rootTag.endsWith('s') ? rootTag.slice(0, -1) : 'item');
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<${rootTag}>\n`;
    jsonData.forEach(record => {
      xml += `  <${actualItemTag}>\n`;
      for (const key in record) {
        if (Object.prototype.hasOwnProperty.call(record, key)) {
          const value = record[key];
          const escapedValue = typeof value === 'string'
            ? value.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"').replace(/'/g, ''')
            : value;
          xml += `    <${key}>${escapedValue}</${key}>\n`;
        }
      }
      xml += `  </${actualItemTag}>\n`;
    });
    xml += `</${rootTag}>`;
    return xml;
  }

  private async parseYaml(yamlString: string): Promise<Record<string, any>[]> {
    // Placeholder: Use a library like 'js-yaml'
    // import yaml from 'js-yaml';
    // try {
    //   const result = yaml.load(yamlString);
    //   return Array.isArray(result) ? result : [result as any];
    // } catch (error) {
    //   console.error('YAML parsing error:', error);
    //   throw error;
    // }
    console.warn('YAML parsing is a placeholder. Returning mock data.');
    return [{ parsed_yaml_field: 'value', original_yaml: yamlString.substring(0,50) + '...' }];
  }

  private async convertJsonToYaml(jsonData: Record<string, any>[], indent: number = 2): Promise<string> {
    // Placeholder: Use a library like 'js-yaml'
    // import yaml from 'js-yaml';
    // try {
    //   return yaml.dump(jsonData.length === 1 && !Array.isArray(jsonData[0]) ? jsonData[0] : jsonData, { indent });
    // } catch (error) {
    //   console.error('JSON to YAML conversion error:', error);
    //   throw error;
    // }
    console.warn('JSON to YAML conversion is a placeholder.');
    return `# YAML representation of JSON data (indent: ${indent})\n` + JSON.stringify(jsonData, null, indent);
  }
}