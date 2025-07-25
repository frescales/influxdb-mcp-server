# Claude.ai Remote MCP Configuration

## Important: Claude.ai vs Claude Desktop

This document explains how to configure the InfluxDB MCP server for **Claude.ai (web version)**, not Claude Desktop.

## Requirements

- Claude Pro, Max, Team, or Enterprise plan (Free plan does NOT support custom connectors)
- InfluxDB instance with valid credentials
- The server deployed to Vercel

## Configuration Steps for Claude.ai

1. **Go to Claude.ai Settings**
   - Click on your profile icon
   - Select "Conectores" (Connectors)

2. **Add Custom Connector**
   - Click "Agregar conector personalizado" (Add custom connector)
   - Enter the following:
     - **Name**: InfluxDB
     - **URL**: `https://influxdb-mcp-server.vercel.app/api/mcp`
   - Leave OAuth fields empty (not required)

3. **Confirm Trust**
   - Check the box to confirm you trust this connector
   - Click "Conectar" (Connect)

## Troubleshooting

### "No tools provided" Issue

If Claude.ai connects but shows no tools, this is because Claude.ai uses a different protocol than Claude Desktop. This server has been updated to support both.

### Testing the Server

1. **Check server health**:
   ```
   https://influxdb-mcp-server.vercel.app/api/health
   ```

2. **Test tools availability**:
   ```
   https://influxdb-mcp-server.vercel.app/api/test-tools
   ```

3. **Test MCP endpoint directly**:
   ```bash
   curl -X POST https://influxdb-mcp-server.vercel.app/api/mcp \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
   ```

## Available Tools in Claude.ai

Once connected, you should see:

- **Write Data to InfluxDB** - Write time-series data
- **Query InfluxDB Data** - Execute Flux queries
- **Create InfluxDB Bucket** - Create new buckets
- **Create InfluxDB Organization** - Create new organizations

## Protocol Details

Claude.ai expects:
- JSON-RPC 2.0 protocol
- Support for batch requests
- Session management via headers
- Proper error handling
- Detailed input schemas with titles and descriptions

## Environment Variables

Ensure these are set in Vercel:
- `INFLUXDB_URL` - Your InfluxDB URL
- `INFLUXDB_TOKEN` - Your InfluxDB API token
