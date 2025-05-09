export class FormatError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'FormatError';
  }
}

export class ErrorHandler {
  static handle(error: unknown): FormatError {
    if (error instanceof FormatError) {
      return error;
    }

    if (error instanceof Error) {
      return new FormatError(
        'UNKNOWN_ERROR',
        error.message,
        { originalError: error }
      );
    }

    return new FormatError(
      'UNKNOWN_ERROR',
      'An unknown error occurred',
      { originalError: error }
    );
  }

  static create(
    code: string,
    message: string,
    details?: Record<string, unknown>
  ): FormatError {
    return new FormatError(code, message, details);
  }

  static isFormatError(error: unknown): error is FormatError {
    return error instanceof FormatError;
  }
}