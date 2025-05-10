# Enterprise Messaging Protocols Guide

## AMQP Implementation
```java
// Java AMQP 1.0 example
ConnectionFactory factory = new ConnectionFactory();
factory.setHost("broker.company.com");
Connection connection = factory.newConnection();
Channel channel = connection.createChannel();

channel.queueDeclare("orders", true, false, false, null);
channel.basicPublish("", "orders", null, orderJson.getBytes());
```

### Configuration Parameters
| Parameter | AMQP 0-9-1 | AMQP 1.0 |
|-----------|------------|----------|
| Port | 5672 | 5672 |
| TLS Port | 5671 | 5671 |
| Frame Size | 131KB | Unlimited |
| QoS | Prefetch Count | Link Credit |

## MQTT Configuration
```yaml
# MQTT Broker Configuration
mqtt:
  version: 3.1.1
  port: 1883
  tlsPort: 8883
  persistence:
    type: leveldb
    path: /var/lib/mqtt/store
  authentication:
    allowAnonymous: false
    passwordFile: /etc/mqtt/passwd
```

## JMS Integration
```java
// JMS Queue Example
ConnectionFactory cf = new ActiveMQConnectionFactory("tcp://localhost:61616");
Connection conn = cf.createConnection();
Session session = conn.createSession(false, Session.AUTO_ACKNOWLEDGE);
Queue queue = session.createQueue("ORDER.QUEUE");
MessageProducer producer = session.createProducer(queue);
TextMessage message = session.createTextMessage(orderJson);
producer.send(message);
```

## Protocol Selection Guide
| Requirement | Recommended Protocol |
|-------------|----------------------|
| IoT Devices | MQTT |
| Enterprise Integration | AMQP |
| Java EE Systems | JMS |
| Web Applications | STOMP |
| High Throughput | AMQP 1.0 |
| Low Bandwidth | MQTT-SN |