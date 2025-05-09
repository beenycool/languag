import { Readable } from 'stream';
import { EncodingHandler } from './encoding-handler';

export class StreamHandler {
  static async bufferToStream(buffer: Uint8Array): Promise<Readable> {
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null); // Signal end of stream
    return stream;
  }

  static async streamToBuffer(stream: Readable): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const chunks: Uint8Array[] = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  static async streamToString(
    stream: Readable, 
    encoding = 'utf-8'
  ): Promise<string> {
    const buffer = await this.streamToBuffer(stream);
    return EncodingHandler.decode(buffer, encoding);
  }

  static async stringToStream(
    content: string,
    encoding = 'utf-8'
  ): Promise<Readable> {
    const buffer = EncodingHandler.encode(content, encoding);
    return await this.bufferToStream(buffer);
  }
}