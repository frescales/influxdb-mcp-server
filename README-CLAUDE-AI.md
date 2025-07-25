# InfluxDB MCP Server for Claude.ai

## ⚠️ Important: This is for Claude.ai (web), NOT Claude Desktop

This guide is specifically for connecting to Claude.ai through the web interface using the Connectors feature.

## Requirements

- **Claude Pro, Max, Team, or Enterprise plan** (Free plan does NOT support custom connectors)
- InfluxDB instance with:
  - Valid API token
  - Known organization name
  - At least one bucket

## Setup Instructions

### 1. Deploy to Vercel (if not already done)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ffrescales%2Finfluxdb-mcp-server&env=INFLUXDB_URL,INFLUXDB_TOKEN&envDescription=InfluxDB%20connection%20details&envLink=https%3A%2F%2Fdocs.influxdata.com%2Finfluxdb%2Fcloud%2Fsecurity%2Ftokens%2F)

### 2. Configure Environment Variables in Vercel

1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add:
   - `INFLUXDB_URL`: Your InfluxDB URL (e.g., `https://us-east-1-1.aws.cloud2.influxdata.com`)
   - `INFLUXDB_TOKEN`: Your InfluxDB API token

### 3. Connect in Claude.ai

1. Go to [claude.ai](https://claude.ai)
2. Click your profile icon → **Configuración** (Settings)
3. Navigate to **Conectores** (Connectors)
4. Click **"Agregar conector personalizado"** (Add custom connector)
5. Fill in:
   - **Nombre**: InfluxDB
   - **URL**: `https://your-project.vercel.app/api/mcp`
   - Leave OAuth fields empty
6. Check "Confirma que confías en este conector"
7. Click **Conectar** (Connect)

## Troubleshooting

### "Sin herramientas proporcionadas" (No tools provided)

This usually means:
1. Environment variables are not set correctly in Vercel
2. The server is not implementing the correct protocol for Claude.ai

### Testing Your Server

1. **Check health**: 
   ```
   https://your-project.vercel.app/api/health
   ```
   Should show `hasToken: true` and `hasUrl: true`

2. **Test tools endpoint**:
   ```
   https://your-project.vercel.app/api/test-tools
   ```
   Should list 4 tools

3. **Test SSE connection**:
   ```
   curl https://your-project.vercel.app/api/mcp
   ```
   Should return an event stream

## Available Tools

Once connected, you should see:

- **write-data**: Write time-series data to InfluxDB
- **query-data**: Execute Flux queries
- **create-bucket**: Create new buckets
- **create-org**: Create new organizations

## Technical Details

### Protocol Implementation

Claude.ai expects:
- Streamable HTTP transport (GET for SSE, POST for JSON-RPC)
- JSON-RPC 2.0 messages
- Proper capability negotiation
- Session management

### Differences from Claude Desktop

| Feature | Claude Desktop | Claude.ai |
|---------|---------------|------------|
| Configuration | Local JSON file | Web UI Connectors |
| Transport | stdio/HTTP | Streamable HTTP only |
| Authentication | Local | OAuth or none |
| Plans | All | Pro+ only |

## Support

If you're still having issues:
1. Check Vercel logs for errors
2. Ensure you're on a Pro+ plan
3. Try disconnecting and reconnecting
4. Open an issue on GitHub with details