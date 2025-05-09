/**
 * @file Defines common message formats for inter-process communication.
 */

export enum MessageType {
  COMMAND = 'command',
  EVENT = 'event',
  QUERY = 'query',
  RESPONSE = 'response',
  ERROR = 'error',
}

export interface MessageHeader {
  messageId: string;
  correlationId?: string;
  timestamp: number;
  source: string;
  target?: string;
  type: MessageType;
}

export interface Message<T = unknown> {
  header: MessageHeader;
  payload: T;
}

export interface CommandMessage<T = unknown> extends Message<T> {
  header: MessageHeader & { type: MessageType.COMMAND };
}

export interface EventMessage<T = unknown> extends Message<T> {
  header: MessageHeader & { type: MessageType.EVENT };
}

export interface QueryMessage<T = unknown> extends Message<T> {
  header: MessageHeader & { type: MessageType.QUERY };
}

export interface ResponseMessage<T = unknown> extends Message<T> {
  header: MessageHeader & { type: MessageType.RESPONSE };
}

export interface ErrorMessagePayload {
  code: string;
  message: string;
  details?: unknown;
}

export interface ErrorMessage extends Message<ErrorMessagePayload> {
  header: MessageHeader & { type: MessageType.ERROR };
}