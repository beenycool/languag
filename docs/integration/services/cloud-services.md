# Cloud Services Integration Guide

## AWS Integration
```javascript
const { AWSIntegration } = require('our-tool/aws');

const aws = new AWSIntegration({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY
  }
});
```

## Azure Setup
```javascript
const { AzureIntegration } = require('our-tool/azure');

const azure = new AzureIntegration({
  tenantId: process.env.AZURE_TENANT_ID,
  clientId: process.env.AZURE_CLIENT_ID,
  clientSecret: process.env.AZURE_CLIENT_SECRET
});
```

## GCP Configuration
```javascript
const { GCPIntegration } = require('our-tool/gcp');

const gcp = new GCPIntegration({
  projectId: 'your-project-id',
  keyFilename: './service-account.json'
});
```

## Security Guidelines
1. Always use environment variables for credentials
2. Implement least-privilege IAM policies
3. Enable audit logging for all services
4. Rotate credentials regularly