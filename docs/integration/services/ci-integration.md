# CI/CD Integration Guide

## GitHub Actions
```yaml
name: Our Analysis
on: [push, pull_request]
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: our-tool/action@v1
        with:
          args: analyze --ci
```

## GitLab CI/CD
```yaml
analyze:
  image: node:16
  script:
    - npm install -g our-tool
    - our-tool analyze --ci
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
```

## Jenkins Setup
```groovy
pipeline {
  agent any
  stages {
    stage('Analysis') {
      steps {
        sh 'npm install -g our-tool'
        sh 'our-tool analyze --ci'
      }
    }
  }
}
```

## Best Practices
1. Cache dependencies between runs
2. Run analysis in parallel with tests
3. Fail fast on critical issues
4. Generate reports as build artifacts