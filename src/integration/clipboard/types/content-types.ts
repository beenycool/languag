export interface TextContent {
  text: string;
  language?: string;
  isRichText?: boolean;
}

export interface ImageContent {
  data: ArrayBuffer;
  width: number;
  height: number;
  format: 'png' | 'jpeg' | 'gif';
}

export interface FileContent {
  name: string;
  type: string;
  size: number;
  data: ArrayBuffer;
}

export type ContentType = TextContent | ImageContent | FileContent;