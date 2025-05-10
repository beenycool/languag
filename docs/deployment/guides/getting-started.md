# Deployment Getting Started Guide

## Setup Instructions

1. **Prerequisites**
   ```bash
   # Install required tools
   npm install -g deploy-cli
   ```

2. **Configuration**
   ```yaml
   # config/deploy.yml
   environments:
     dev:
       url: https://dev.example.com
     prod:
       url: https://example.com
   ```

## Basic Usage

1. **Initial Deployment**
   ```bash
   deploy init
   deploy push
   deploy release
   ```

2. **Common Patterns**
   - Blue-green deployments
   - Canary releases
   - Feature flags

## Examples

1. **Simple Web App**
   ```bash
   deploy init --template=webapp
   deploy push --env=staging
   ```

2. **Microservices**
   ```bash
   deploy init --template=services
   deploy push --service=auth
   ```

[See Best Practices](./best-practices.md) for advanced techniques.