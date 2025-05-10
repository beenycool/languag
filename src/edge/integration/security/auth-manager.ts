export class EdgeAuthManager {
  private tokenExpiration = 300_000; // 5 minutes
  private attestationCache = new Map<string, CryptoKey>();

  async generateDeviceAttestation(): Promise<string> {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify']
    );
    
    const attestation = {
      algorithm: 'ES256',
      publicKey: await crypto.subtle.exportKey('jwk', keyPair.publicKey),
      timestamp: Date.now(),
      kid: btoa(
        String.fromCharCode(...new Uint8Array(
          await crypto.subtle.digest('SHA-256',
            new TextEncoder().encode(
              JSON.stringify(keyPair.publicKey)
            )
          )
        ))
      ).slice(0, 8)
    };

    this.attestationCache.set(attestation.kid, keyPair.privateKey);
    return JSON.stringify(attestation);
  }

  async createSessionToken(deviceAttestation: string): Promise<string> {
    const { publicKey, timestamp } = JSON.parse(deviceAttestation);
    if (Date.now() - timestamp > 60_000) {
      throw new Error('Attestation expired');
    }

    const privateKey = this.attestationCache.get(publicKey.kid);
    if (!privateKey) throw new Error('Invalid attestation');

    const token = new TextEncoder().encode(`${publicKey.kid}:${Date.now()}`);
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privateKey,
      token
    );

    return btoa(JSON.stringify({
      token: Array.from(token),
      sig: Array.from(new Uint8Array(signature)),
      exp: Date.now() + this.tokenExpiration
    }));
  }
}