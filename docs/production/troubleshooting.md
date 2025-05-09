# Troubleshooting Guide

## Common Issues
1. **LLM Connection Failures**:
   - Check [`src/main/llm/ollama-connector.ts`](src/main/llm/ollama-connector.ts)
   - Verify network connectivity
   - Validate API keys

2. **Performance Degradation**:
   - Review metrics from [`src/monitoring`](src/monitoring)
   - Check resource utilization
   - Analyze recent changes

## Debug Procedures
1. **Log Collection**:
   ```bash
   npm run logs:collect
   ```

2. **Diagnostic Tools**:
   - Heap dumps
   - CPU profiling
   - Network tracing

## Recovery Steps
1. **Service Restart**:
   ```bash
   npm run restart
   ```

2. **Configuration Reset**:
   ```bash
   npm run config:reset
   ```

## Support Resources
1. **Documentation**:
   - [`docs/`](docs/) directory
2. **Monitoring**:
   - Grafana dashboards
   - Alert history