# Deployment Operations Guide

## Deployment Checklist
1. **Pre-Deployment**:
   - Verify tests pass (`npm test`)
   - Check dependency updates (`npm outdated`)
   - Validate configurations in [`src/main/services/config-manager.ts`](src/main/services/config-manager.ts)

2. **Deployment**:
   ```bash
   # Production deployment
   npm run deploy:prod
   ```

## Release Procedures
1. Create release branch
2. Update version in `package.json`
3. Run integration tests
4. Deploy to staging
5. Final production rollout

## Verification Steps
1. Health checks:
   ```bash
   curl http://localhost:3000/health
   ```
2. Metric validation:
   - Check [`src/monitoring/production/metrics`](src/monitoring/production/metrics)
3. Smoke tests

## Rollback Procedures
1. Identify last stable version
2. Revert deployment
3. Restore backups if needed
4. Post-mortem analysis