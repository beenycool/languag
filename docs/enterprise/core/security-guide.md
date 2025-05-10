# Enterprise Integration Security Guide

## Authentication Setup
```typescript
// Example JWT validation middleware
import { verify } from 'jsonwebtoken';

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).send('Unauthorized');

  try {
    req.user = verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(403).send('Invalid token');
  }
};
```

## Policy Management
1. **Access Control Policies**:
   - Role-based access control (RBAC)
   - Attribute-based access control (ABAC)
   - Service-level permissions

2. **Example Policy Definition**:
```yaml
policies:
  - name: order-service-write
    description: Allow write access to order service
    effect: allow
    actions: ["POST:/orders", "PUT:/orders/*"]
    conditions:
      - role: order-manager
      - department: sales
```

## Compliance Requirements
| Standard | Requirements | Implementation |
|----------|--------------|----------------|
| PCI DSS  | Encryption, logging | TLS 1.2+, audit logs |
| GDPR     | Data protection | Pseudonymization |
| HIPAA    | PHI security | Access controls, encryption |

## Security Patterns
1. **Zero Trust Architecture**:
   - Verify every request
   - Least privilege access
   - Micro-segmentation

2. **Defense in Depth**:
   - Network perimeter security
   - Application layer security
   - Data encryption
   - Audit logging

3. **Threat Mitigation**:
   - Rate limiting
   - Input validation
   - Secure headers
   - Regular patching