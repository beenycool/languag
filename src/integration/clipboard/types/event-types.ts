import { ContentType } from './content-types';

export interface ClipboardChangeEvent {
  type: 'change';
  content: ContentType;
  timestamp: number;
  source?: string;
}

export interface ClipboardErrorEvent {
  type: 'error';
  error: Error;
  timestamp: number;
  operation: string;
}

export interface ClipboardFormatEvent {
  type: 'format';
  format: string;
  timestamp: number;
}

export type ClipboardEvent = 
  | ClipboardChangeEvent
  | ClipboardErrorEvent
  | ClipboardFormatEvent;