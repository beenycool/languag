# Collaboration Tools Integration Guide

## Teams Integration
```javascript
const { TeamsIntegration } = require('our-tool/teams');

const teams = new TeamsIntegration({
  webhookUrl: process.env.TEAMS_WEBHOOK,
  channel: 'code-reviews'
});
```

## Slack Setup
1. Create Slack app:
```bash
our-tool slack --init
```

2. Configure events:
```json
{
  "slack": {
    "events": ["pull_request", "code_analysis"],
    "channels": ["#engineering"]
  }
}
```

## Discord Usage
```javascript
const discord = require('our-tool/discord');

discord.init({
  token: process.env.DISCORD_TOKEN,
  channelId: '1234567890'
});
```

## Message Formats
Customize notification format:
```json
{
  "notifications": {
    "format": "compact",
    "includeCodeSnippets": true,
    "maxLength": 500
  }
}