# Data Connectors Guide

## Database Integration
```typescript
// PostgreSQL connector example
const pgConfig = {
  type: "postgresql",
  host: "db.example.com",
  port: 5432,
  database: "analytics",
  user: "reader",
  password: "secure123",
  pool: {
    min: 2,
    max: 10
  }
};

// MongoDB connector
const mongoConfig = {
  type: "mongodb",
  connectionString: "mongodb://user:pass@host1:27017,host2:27017/db",
  readPreference: "secondaryPreferred"
};
```

## Stream Source Setup
```typescript
// Kafka consumer config
const kafkaConfig = {
  brokers: ["kafka1:9092", "kafka2:9092"],
  topics: ["events.prod"],
  groupId: "analytics-group",
  fromBeginning: false
};
```

## Configuration Options
| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| type | Yes | - | Connector type |
| hosts | Yes | - | Server addresses |
| credentials | No | - | Auth details |
| timeout | No | 30000 | Connection timeout (ms) |
| retries | No | 3 | Connection retries |