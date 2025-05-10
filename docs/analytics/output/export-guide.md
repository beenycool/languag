# Data Export Guide

## Supported Formats
```typescript
// Export configuration
const exportConfig = {
  formats: [
    {
      type: "csv",
      options: {
        delimiter: ",",
        includeHeader: true
      }
    },
    {
      type: "json",
      options: {
        pretty: true,
        dateFormat: "iso"
      }
    },
    {
      type: "parquet",
      options: {
        compression: "snappy"
      }
    }
  ]
};
```

## Report Generation
```typescript
// Scheduled report export
const reportExport = {
  query: "user_activity",
  format: "pdf",
  delivery: {
    method: "email",
    recipients: ["analytics@company.com"],
    schedule: "0 6 * * *" // Daily at 6AM
  }
};
```

## Export Patterns
| Pattern | Use Case | Performance |
|---------|----------|-------------|
| Full Dump | Data migration | High resource use |
| Incremental | Daily updates | Efficient |
| Filtered | Subset extraction | Depends on filter |
| Aggregated | Summary data | Reduced volume |