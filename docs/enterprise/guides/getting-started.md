# Enterprise Integration Developer Guide

## Setup Instructions
1. **Prerequisites**:
   ```bash
   # Required tools
   java -version # 11+
   node --version # 16+
   docker --version
   kubectl version
   ```

2. **Local Development Environment**:
   ```bash
   git clone https://github.com/company/integration-platform.git
   cd integration-platform
   ./gradlew build
   docker-compose up -d
   ```

## Basic Usage
```java
// Creating a simple integration flow
@Bean
public IntegrationFlow fileProcessingFlow() {
    return IntegrationFlows
        .from(Files.inboundAdapter(new File("/input")))
        .transform(new FileToStringTransformer())
        .handle(Message::getPayload)
        .get();
}
```

## Common Patterns
1. **Request-Reply**:
   ```python
   # Python example
   response = requests.post(
       'http://gateway/api/orders',
       json=order_data,
       headers={'Authorization': f'Bearer {token}'}
   )
   ```

2. **Event-Driven**:
   ```javascript
   // Node.js event consumer
   amqp.connect('amqp://localhost').then(conn => {
     return conn.createChannel().then(ch => {
       ch.consume('orders', msg => {
         console.log('Received:', msg.content.toString());
         ch.ack(msg);
       });
     });
   });
   ```

## Examples
| Scenario | Technology | Example Location |
|----------|------------|------------------|
| File Processing | Spring Integration | `/examples/file-processor` |
| API Gateway | Node.js | `/examples/api-gateway` |
| Event Streaming | Kafka | `/examples/event-stream` |
| Batch Processing | Spring Batch | `/examples/batch-job` |