# Enterprise Integration Troubleshooting Guide

## Common Issues
1. **Connection Failures**:
   ```bash
   # Diagnostic commands
   telnet gateway.company.com 8080
   openssl s_client -connect gateway.company.com:8443
   curl -v http://gateway.company.com/health
   ```

2. **Performance Problems**:
   ```bash
   # Linux performance tools
   top -H -p $(pgrep -f integration-service)
   iostat -x 1
   tcpdump -i eth0 -w capture.pcap port 8080
   ```

## Debug Procedures
1. **Log Analysis**:
   ```bash
   # Common log search patterns
   grep -i "error\|exception\|fail" /var/log/integration.log
   journalctl -u integration-service --since "1 hour ago"
   ```

2. **Debug Endpoints**:
   ```yaml
   # Spring Boot Actuator example
   management:
     endpoints:
       web:
         exposure:
           include: health,info,metrics,env
     endpoint:
       health:
         show-details: always
   ```

## Error Handling
| Error Code | Likely Cause | Resolution |
|------------|--------------|------------|
| 401 | Invalid credentials | Renew OAuth token |
| 403 | Insufficient permissions | Check RBAC policies |
| 502 | Backend unavailable | Check service health |
| 504 | Gateway timeout | Increase timeout settings |

## Support Resources
1. **Internal Documentation**: [Enterprise Integration Wiki](https://wiki.company.com/integration)
2. **Monitoring Dashboards**: [Grafana](https://monitoring.company.com)
3. **Incident Response**: #integration-support Slack channel
4. **Runbooks**: `/docs/runbooks` in source repository