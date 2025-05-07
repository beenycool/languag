import { sanitizeInput, sanitizeOutput, sanitizeError } from '../sanitization';

describe('Sanitization Utilities', () => {
  describe('sanitizeInput', () => {
    it('should escape HTML special characters', () => {
      const input = '<script>alert("xss & `tick`")</script>';
      const expected = '<script>alert("xss & &#x60;tick&#x60;")</script>';
      expect(sanitizeInput(input)).toBe(expected);
    });

    it('should handle empty strings', () => {
      expect(sanitizeInput('')).toBe('');
    });

    it('should return the same string if no special characters are present', () => {
      const input = 'This is a safe string.';
      expect(sanitizeInput(input)).toBe(input);
    });

    it('should handle non-string input by returning an empty string', () => {
      expect(sanitizeInput(null as any)).toBe('');
      expect(sanitizeInput(undefined as any)).toBe('');
      expect(sanitizeInput(123 as any)).toBe('');
      expect(sanitizeInput({} as any)).toBe('');
    });

    it('should correctly sanitize single quotes', () => {
      const input = "O'Malley's Bar";
      const expected = "O&#x27;Malley&#x27;s Bar";
      expect(sanitizeInput(input)).toBe(expected);
    });
  });

  describe('sanitizeOutput', () => {
    it('should escape HTML special characters in output', () => {
      const output = '<script>alert("output xss & `tick`")</script>';
      const expected = '<script>alert("output xss & &#x60;tick&#x60;")</script>';
      expect(sanitizeOutput(output)).toBe(expected);
    });

    it('should handle undefined input for output sanitization', () => {
      expect(sanitizeOutput(undefined)).toBe('');
    });

    it('should handle empty strings for output', () => {
      expect(sanitizeOutput('')).toBe('');
    });
  });

  describe('sanitizeError', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv; // Restore original NODE_ENV
    });

    it('should return a generic message in production', () => {
      process.env.NODE_ENV = 'production';
      const message = 'Detailed error message with sensitive info';
      const expected = 'An error occurred. Please check logs for details.';
      expect(sanitizeError(message)).toBe(expected);
    });

    it('should return the original message in development', () => {
      process.env.NODE_ENV = 'development';
      const message = 'Detailed error message for dev';
      expect(sanitizeError(message)).toBe(message);
    });

    it('should include context in production message', () => {
      process.env.NODE_ENV = 'production';
      const message = 'DB connection failed';
      const context = 'Database Operation';
      const expected = 'An error occurred during Database Operation. Please check logs for details.';
      expect(sanitizeError(message, context)).toBe(expected);
    });

    it('should include context in development message (original message is returned)', () => {
      process.env.NODE_ENV = 'development';
      const message = 'DB connection failed';
      const context = 'Database Operation';
      // In dev, the original message is returned, context is used if message is empty
      expect(sanitizeError(message, context)).toBe(message);
    });

    it('should return a base message with context if original message is empty in development', () => {
      process.env.NODE_ENV = 'development';
      const message = '';
      const context = 'Empty Error Context';
      const expected = 'An error occurred during Empty Error Context.';
      expect(sanitizeError(message, context)).toBe(expected);
    });

    it('should return a base message if original message is empty and no context in development', () => {
        process.env.NODE_ENV = 'development';
        const message = '';
        const expected = 'An error occurred.';
        expect(sanitizeError(message)).toBe(expected);
      });

    it('should default to development-like behavior if NODE_ENV is not set', () => {
      delete process.env.NODE_ENV;
      const message = 'Sensitive details here';
      expect(sanitizeError(message)).toBe(message); // Assumes non-production if NODE_ENV is undefined
    });
  });
});