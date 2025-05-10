import { createHmac } from 'crypto';

export class DeviceAuthenticator {
  private secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  generateChallenge(deviceId: string): string {
    const timestamp = Date.now();
    return `${deviceId}:${timestamp}:${this.sign(deviceId + timestamp)}`;
  }

  verifySignature(deviceId: string, signature: string): boolean {
    const [receivedId, timestamp, receivedHash] = signature.split(':');
    if (receivedId !== deviceId) return false;
    
    const expectedHash = this.sign(deviceId + timestamp);
    return this.secureCompare(receivedHash, expectedHash);
  }

  private sign(data: string): string {
    return createHmac('sha256', this.secret)
      .update(data)
      .digest('hex');
  }

  private secureCompare(a: string, b: string): boolean {
    const aBuffer = Buffer.from(a);
    const bBuffer = Buffer.from(b);
    return aBuffer.length === bBuffer.length && 
      aBuffer.compare(bBuffer) === 0;
  }
}