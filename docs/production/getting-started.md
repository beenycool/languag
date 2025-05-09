# Production Developer Guide

## Environment Setup
1. **Prerequisites**:
   - Node.js 18+
   - npm 9+
   - Docker (for local services)

2. **Installation**:
   ```bash
   git clone <repository>
   npm install
   cp .env.example .env
   ```

## Configuration
Key files:
- [`src/main/services/config-manager.ts`](src/main/services/config-manager.ts)
- `package.json` scripts
- `.env` environment variables

## Basic Usage
1. **Development**:
   ```bash
   npm run dev
   ```

2. **Production**:
   ```bash
   npm run build
   npm start
   ```

## Examples
1. **LLM Integration**:
   ```typescript
   import { OllamaConnector } from './llm/ollama-connector';
   const llm = new OllamaConnector();
   ```

2. **Monitoring**:
   ```typescript
   import { MetricCollector } from './monitoring/core/collectors';
   const metrics = new MetricCollector();