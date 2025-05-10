export class EdgeCryptoService {
  private key!: CryptoKey; // Definite assignment assertion

  async init() {
    this.key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  async encrypt(data: ArrayBuffer): Promise<ArrayBuffer> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    return crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.key,
      data
    );
  }

  async decrypt(data: ArrayBuffer, iv: Uint8Array): Promise<ArrayBuffer> {
    return crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      this.key,
      data
    );
  }
}