/**
 * @file Data Adapter
 *
 * This file defines the data adapter for transforming data between different
 * formats and structures within enterprise integrations. It supports mapping,
 * validation, and enrichment of data.
 *
 * Focus areas:
 * - Reliability: Ensures accurate and consistent data transformations.
 * - Performance monitoring: Tracks the performance of data transformation processes.
 * - Error handling: Manages errors during data mapping and validation.
 * - Scalability: Handles large volumes of data for transformation.
 */

interface IDataMappingRule {
  sourceField: string; // Path to source field (e.g., 'user.profile.emailAddress')
  targetField: string; // Path to target field (e.g., 'customer.contact.email')
  transformation?: (value: any, sourceObject?: any, targetObject?: any) => any; // Optional transformation function
  defaultValue?: any; // Value to use if source is null or undefined
  required?: boolean; // If true, an error is thrown if source value is missing and no default
}

interface IDataValidationRule {
  field: string; // Path to field in the target object
  validator: (value: any, targetObject?: any) => boolean | Promise<boolean>; // Returns true if valid
  errorMessage: string; // Error message if validation fails
}

interface ITransformationResult<T> {
  data?: T;
  success: boolean;
  errors?: Array<{ field?: string; message: string; originalValue?: any }>;
  validationErrors?: Array<{ field: string; message: string; value: any }>;
}

interface IDataAdapter {
  /**
   * Transforms source data to a target structure based on mapping rules.
   * @param sourceData The source data object.
   * @param mappingRules An array of rules defining how to map source to target.
   * @param validationRules Optional array of rules to validate the transformed data.
   * @returns A promise that resolves with the transformation result.
   */
  transform<S = any, T = any>(
    sourceData: S,
    mappingRules: IDataMappingRule[],
    validationRules?: IDataValidationRule[]
  ): Promise<ITransformationResult<T>>;

  /**
   * Validates data against a set of rules.
   * @param data The data to validate.
   * @param rules An array of validation rules.
   * @returns A promise that resolves with an array of validation errors (empty if valid).
   */
  validate<T = any>(data: T, rules: IDataValidationRule[]): Promise<Array<{ field: string; message: string; value: any }>>;
}

export class DataAdapter implements IDataAdapter {
  constructor() {
    console.log('Data Adapter initialized.');
  }

  // Helper to get/set nested properties using dot notation
  private getProperty(obj: any, path: string): any {
    return path.split('.').reduce((o, k) => (o && o[k] !== 'undefined') ? o[k] : undefined, obj);
  }

  private setProperty(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
  }

  public async transform<S = any, T = any>(
    sourceData: S,
    mappingRules: IDataMappingRule[],
    validationRules?: IDataValidationRule[]
  ): Promise<ITransformationResult<T>> {
    const targetData: any = {};
    const errors: Array<{ field?: string; message: string; originalValue?: any }> = [];

    console.log('Starting data transformation. Source:', sourceData);

    for (const rule of mappingRules) {
      try {
        let value = this.getProperty(sourceData, rule.sourceField);

        if (value === undefined || value === null) {
          if (rule.defaultValue !== undefined) {
            value = rule.defaultValue;
          } else if (rule.required) {
            errors.push({
              field: rule.sourceField,
              message: `Required source field '${rule.sourceField}' is missing and no default value provided.`,
            });
            continue; // Skip setting this field if required and missing
          } else {
            // If not required and no default, we might skip or set to undefined explicitly
            // Depending on desired behavior, for now, we'll allow setting undefined
          }
        }

        if (rule.transformation) {
          value = rule.transformation(value, sourceData, targetData);
        }

        this.setProperty(targetData, rule.targetField, value);
      } catch (error: any) {
        errors.push({
          field: rule.sourceField,
          message: `Error transforming field '${rule.sourceField}': ${error.message}`,
          originalValue: this.getProperty(sourceData, rule.sourceField),
        });
      }
    }

    if (errors.length > 0) {
      console.warn('Transformation encountered errors:', errors);
      return { success: false, errors, data: targetData as T }; // Return partially transformed data with errors
    }

    let validationErrors: Array<{ field: string; message: string; value: any }> = [];
    if (validationRules && validationRules.length > 0) {
      validationErrors = await this.validate(targetData, validationRules);
    }

    if (validationErrors.length > 0) {
      console.warn('Transformed data failed validation:', validationErrors);
      return { success: false, data: targetData as T, validationErrors };
    }

    console.log('Data transformation successful. Target:', targetData);
    return { success: true, data: targetData as T };
  }

  public async validate<T = any>(data: T, rules: IDataValidationRule[]): Promise<Array<{ field: string; message: string; value: any }>> {
    const validationErrors: Array<{ field: string; message: string; value: any }> = [];
    console.log('Starting data validation. Data:', data);

    for (const rule of rules) {
      const value = this.getProperty(data, rule.field);
      try {
        const isValid = await Promise.resolve(rule.validator(value, data));
        if (!isValid) {
          validationErrors.push({ field: rule.field, message: rule.errorMessage, value });
        }
      } catch (error: any) {
        validationErrors.push({ field: rule.field, message: `Validator for field '${rule.field}' threw an error: ${error.message}`, value });
      }
    }
    if (validationErrors.length > 0) {
        console.warn('Validation errors found:', validationErrors);
    } else {
        console.log('Data validation successful.');
    }
    return validationErrors;
  }
}

// Example usage (conceptual)
// const dataAdapter = new DataAdapter();

// const source = {
//   userInfo: { id: 123, name: 'John Doe', contactEmail: 'john.doe@example.com', age: '30' },
//   order: { orderId: 'XYZ789', amount: 100.50 }
// };

// const mapping: IDataMappingRule[] = [
//   { sourceField: 'userInfo.id', targetField: 'customer.customerId' },
//   { sourceField: 'userInfo.name', targetField: 'customer.fullName' },
//   { sourceField: 'userInfo.contactEmail', targetField: 'customer.email', required: true },
//   { sourceField: 'userInfo.age', targetField: 'customer.yearsOld', transformation: (val) => parseInt(val, 10) },
//   { sourceField: 'order.orderId', targetField: 'purchase.transactionId' },
//   { sourceField: 'order.amount', targetField: 'purchase.value' },
//   { sourceField: 'nonExistent.field', targetField: 'customer.status', defaultValue: 'active' }
// ];

// const validation: IDataValidationRule[] = [
//   { field: 'customer.email', validator: (val) => typeof val === 'string' && val.includes('@'), errorMessage: 'Invalid email format.' },
//   { field: 'customer.yearsOld', validator: (val) => typeof val === 'number' && val >= 18, errorMessage: 'Customer must be 18 or older.'}
// ];

// dataAdapter.transform(source, mapping, validation)
//   .then(result => {
//     if (result.success) {
//       console.log('Transformed Data:', result.data);
//     } else {
//       console.error('Transformation Failed:');
//       if (result.errors) console.error('Mapping Errors:', result.errors);
//       if (result.validationErrors) console.error('Validation Errors:', result.validationErrors);
//     }
//   });