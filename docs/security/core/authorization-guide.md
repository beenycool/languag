# Authorization Guide

## Permission System
```typescript
// From [permission-manager.ts](src/security/core/authorization/permission-manager.ts)
type Permission = {
  resource: string;
  action: 'read' | 'write' | 'delete';
};
```

## Role Management
- Predefined roles (Admin, User, Guest)
- Custom role creation
- Role inheritance

## Policy Enforcement Points
1. API Gateways
2. Service boundaries
3. Data access layers

## Security Patterns
- Attribute-Based Access Control (ABAC)
- Role-Based Access Control (RBAC)
- Policy-as-Code implementation