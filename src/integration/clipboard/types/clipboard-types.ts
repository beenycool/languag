export interface ClipboardEvent {
  type: string;
  content: string;
  timestamp: number;
  format?: string;
}

export interface ClipboardContent {
  text: string;
  html?: string;
  rtf?: string;
  image?: ArrayBuffer;
}

export type ClipboardFormat = 'text/plain' | 'text/html' | 'text/rtf' | 'image/png';