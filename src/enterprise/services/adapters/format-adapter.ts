/**
 * @file Format Adapter
 *
 * This file defines the format adapter for converting data between different
 * serialization formats (e.g., JSON, XML, CSV, Protobuf).
 *
 * Focus areas:
 * - Reliability: Ensures accurate conversion between formats.
 * - Performance monitoring: Tracks the speed of format conversions.
 * - Error handling: Manages errors during parsing and serialization.
 * - Scalability: Can handle large data payloads for conversion.
 */

interface IFormatConversionRequest<T> {
  sourceFormat: 'json' | 'xml' | 'csv' | 'protobuf' | 'yaml' | string; // Extensible
  targetFormat: 'json' | 'xml' | 'csv' | 'protobuf' | 'yaml' | string; // Extensible
  data: T; // The data to convert (string for text-based, Buffer for binary)
  options?: Record<string, any>; // Format-specific options (e.g., XML root name, CSV delimiter, Protobuf schema)
}

interface IFormatConversionResponse<R> {
  success: boolean;
  convertedData?: R; // Converted data (string or Buffer)
  error?: string;
  details?: any;
}

interface IFormatConverter {
  /**
   * Checks if this converter can handle the requested conversion.
   * @param sourceFormat The source format.
   * @param targetFormat The target format.
   * @returns True if supported, false otherwise.
   */
  supports(sourceFormat: string, targetFormat: string): boolean;

  /**
   * Converts data from source format to target format.
   * @param request The conversion request.
   * @returns A promise that resolves with the conversion response.
   */
  convert<S = any, R = any>(request: IFormatConversionRequest<S>): Promise<IFormatConversionResponse<R>>;
}

export class FormatAdapterRegistry {
  private converters: IFormatConverter[] = [];

  constructor() {
    console.log('Format Adapter Registry initialized.');
    // TODO: Register built-in or common converters (e.g., JSON <-> XML)
    // this.registerConverter(new JsonToXmlConverter());
    // this.registerConverter(new XmlToJsonConverter());
  }

  registerConverter(converter: IFormatConverter): void {
    this.converters.push(converter);
    console.log(`Registered a format converter: ${converter.constructor.name}`);
  }

  async adapt<S = any, R = any>(request: IFormatConversionRequest<S>): Promise<IFormatConversionResponse<R>> {
    const suitableConverter = this.converters.find(
      (c) => c.supports(request.sourceFormat.toLowerCase(), request.targetFormat.toLowerCase())
    );

    if (!suitableConverter) {
      const errorMessage = `No suitable format converter found for ${request.sourceFormat} to ${request.targetFormat}.`;
      console.error(errorMessage);
      return { success: false, error: errorMessage };
    }

    console.log(`Using converter for ${request.sourceFormat} -> ${request.targetFormat}.`);
    try {
      return await suitableConverter.convert(request);
    } catch (error: any) {
      console.error(`Error during format conversion by ${suitableConverter.constructor.name}:`, error);
      return { success: false, error: error.message, details: error };
    }
  }
}

/**
 * Example: JSON to XML Converter (Simplified)
 * A real implementation would use a robust XML library (e.g., xml2js, fast-xml-parser).
 */
export class JsonToXmlConverter implements IFormatConverter {
  supports(sourceFormat: string, targetFormat: string): boolean {
    return sourceFormat.toLowerCase() === 'json' && targetFormat.toLowerCase() === 'xml';
  }

  async convert<S = any, R = string>(
    request: IFormatConversionRequest<S>
  ): Promise<IFormatConversionResponse<R>> {
    if (!this.supports(request.sourceFormat, request.targetFormat)) {
      return { success: false, error: 'Converter does not support this format pair.' };
    }

    let jsonData: Record<string, any>;
    if (typeof request.data === 'string') {
      try {
        jsonData = JSON.parse(request.data);
      } catch (e: any) {
        return { success: false, error: `Invalid JSON input: ${e.message}` };
      }
    } else if (typeof request.data === 'object' && request.data !== null) {
      jsonData = request.data as Record<string, any>;
    } else {
      return { success: false, error: 'Invalid data type for JSON input. Expected string or object.' };
    }

    const rootName = request.options?.rootName || 'root';

    // Extremely simplified XML conversion for demonstration
    const toXml = (obj: any, name: string): string => {
      if (Array.isArray(obj)) {
        return obj.map(item => toXml(item, name)).join('');
      } else if (typeof obj === 'object' && obj !== null) {
        const children = Object.keys(obj)
          .map(key => toXml(obj[key], key))
          .join('');
        return `<${name}>${children}</${name}>`;
      } else {
        return `<${name}>${String(obj).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</${name}>`;
      }
    };

    try {
      const xmlData = `<?xml version="1.0" encoding="UTF-8"?>${toXml(jsonData, rootName)}`;
      return { success: true, convertedData: xmlData as R };
    } catch (e: any) {
      return { success: false, error: `Error converting JSON to XML: ${e.message}` };
    }
  }
}

/**
 * Example: XML to JSON Converter (Simplified)
 * A real implementation would use a robust XML library.
 */
export class XmlToJsonConverter implements IFormatConverter {
    supports(sourceFormat: string, targetFormat: string): boolean {
      return sourceFormat.toLowerCase() === 'xml' && targetFormat.toLowerCase() === 'json';
    }
  
    async convert<S = any, R = Record<string, any>>(
      request: IFormatConversionRequest<S>
    ): Promise<IFormatConversionResponse<R>> {
      if (!this.supports(request.sourceFormat, request.targetFormat)) {
        return { success: false, error: 'Converter does not support this format pair.' };
      }
      if (typeof request.data !== 'string') {
        return { success: false, error: 'XML input must be a string.' };
      }
      
      // This is a placeholder for actual XML parsing.
      // Real parsing is complex (attributes, mixed content, namespaces, etc.)
      // Using a library like 'fast-xml-parser' or 'xml2js' is essential.
      console.warn("XML to JSON conversion is highly simplified and not robust.");
      try {
        // Extremely naive "parsing" - DO NOT USE IN PRODUCTION
        const simplifiedJson = { message: "XML content received (not actually parsed)", rawXml: request.data };
        return { success: true, convertedData: simplifiedJson as R };
      } catch (e: any) {
        return { success: false, error: `Error converting XML to JSON: ${e.message}` };
      }
    }
  }


// Example usage (conceptual)
// const formatRegistry = new FormatAdapterRegistry();
// formatRegistry.registerConverter(new JsonToXmlConverter());
// formatRegistry.registerConverter(new XmlToJsonConverter());

// async function testFormatConversion() {
//   const jsonData = { user: { id: 1, name: "Test User", active: true } };
//   const jsonToXmlRequest: IFormatConversionRequest<typeof jsonData> = {
//     sourceFormat: 'json',
//     targetFormat: 'xml',
//     data: jsonData,
//     options: { rootName: 'userData' }
//   };

//   const xmlResult = await formatRegistry.adapt(jsonToXmlRequest);
//   if (xmlResult.success) {
//     console.log('Converted XML:', xmlResult.convertedData);

//     const xmlToJsonRequest: IFormatConversionRequest<string> = {
//         sourceFormat: 'xml',
//         targetFormat: 'json',
//         data: xmlResult.convertedData as string
//     };
//     const jsonAgainResult = await formatRegistry.adapt(xmlToJsonRequest);
//     if (jsonAgainResult.success) {
//         console.log('Converted JSON back:', jsonAgainResult.convertedData);
//     } else {
//         console.error('XML to JSON Failed:', jsonAgainResult.error);
//     }

//   } else {
//     console.error('JSON to XML Failed:', xmlResult.error);
//   }
// }

// testFormatConversion();