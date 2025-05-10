# IoT Security Guide

## Device Authentication
```typescript
// Mutual TLS authentication
const tlsConfig = {
  cert: fs.readFileSync('certs/device-cert.pem'),
  key: fs.readFileSync('certs/device-key.pem'),
  ca: [fs.readFileSync('certs/ca-cert.pem')],
  rejectUnauthorized: true
};

const secureClient = mqtt.connect('mqtts://iot-broker.com', tlsConfig);
```

## Certificate Management
```bash
# Generate device certificate
openssl req -new -x509 -days 365 -nodes \
  -out device-cert.pem \
  -keyout device-key.pem \
  -subj "/CN=iot-device-123"
```

## Encryption Setup
```yaml
# Security policy configuration
security:
  transport:
    protocol: TLSv1.3
    ciphers: ECDHE-ECDSA-AES256-GCM-SHA384
  data:
    encryption: AES-256-CBC
    keyRotation: 30d
  access:
    jwt:
      issuer: iot-auth-service
      audience: iot-platform
```

[See security implementation](src/iot/security/device-authenticator.ts)