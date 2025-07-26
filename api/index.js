// Landing page for InfluxDB MCP Server
// Provides debugging information and OAuth status

import { clients, tokens, authCodes } from './oauth-config.js';

export default function handler(req, res) {
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const baseUrl = `${protocol}://${host}`;
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>InfluxDB MCP Server</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #e0e0e0;
      line-height: 1.6;
      padding: 2rem;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    h1 {
      font-size: 3rem;
      margin-bottom: 0.5rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    h2 {
      font-size: 1.8rem;
      margin: 2rem 0 1rem;
      color: #667eea;
    }
    h3 {
      font-size: 1.3rem;
      margin: 1.5rem 0 0.8rem;
      color: #9ca3af;
    }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      background: #1f2937;
      border-radius: 9999px;
      font-size: 0.875rem;
      margin-right: 0.5rem;
      margin-bottom: 0.5rem;
      border: 1px solid #374151;
    }
    .badge.success { border-color: #10b981; color: #10b981; }
    .badge.warning { border-color: #f59e0b; color: #f59e0b; }
    .badge.error { border-color: #ef4444; color: #ef4444; }
    .badge.info { border-color: #3b82f6; color: #3b82f6; }
    
    .status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1.5rem;
      margin: 2rem 0;
    }
    .status-card {
      background: #1f2937;
      border: 1px solid #374151;
      border-radius: 0.75rem;
      padding: 1.5rem;
    }
    .status-card h3 {
      margin-top: 0;
    }
    
    .endpoint-list {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 0.5rem;
      padding: 1rem;
      margin: 1rem 0;
      font-family: 'Courier New', monospace;
      font-size: 0.9rem;
    }
    .endpoint-list li {
      list-style: none;
      padding: 0.5rem 0;
      border-bottom: 1px solid #1f2937;
    }
    .endpoint-list li:last-child {
      border-bottom: none;
    }
    .endpoint-list .method {
      display: inline-block;
      width: 60px;
      font-weight: bold;
    }
    .endpoint-list .method.get { color: #10b981; }
    .endpoint-list .method.post { color: #3b82f6; }
    
    code {
      background: #1f2937;
      padding: 0.2rem 0.4rem;
      border-radius: 0.25rem;
      font-size: 0.9rem;
      color: #f9a8d4;
    }
    
    .tool-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 1rem;
      margin: 1rem 0;
    }
    .tool-card {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 0.5rem;
      padding: 1rem;
    }
    .tool-card h4 {
      color: #a78bfa;
      margin-bottom: 0.5rem;
    }
    .tool-card p {
      font-size: 0.875rem;
      color: #9ca3af;
    }
    
    .debug-section {
      background: #111827;
      border: 1px solid #ef4444;
      border-radius: 0.5rem;
      padding: 1.5rem;
      margin: 2rem 0;
    }
    .debug-section h3 {
      color: #ef4444;
    }
    
    pre {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 0.5rem;
      padding: 1rem;
      overflow-x: auto;
      font-size: 0.875rem;
      margin: 1rem 0;
    }
    
    a {
      color: #667eea;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    
    .footer {
      margin-top: 4rem;
      padding-top: 2rem;
      border-top: 1px solid #374151;
      text-align: center;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>InfluxDB MCP Server</h1>
    <p style="font-size: 1.2rem; color: #9ca3af; margin-bottom: 1rem;">
      Model Context Protocol server for InfluxDB time-series database
    </p>
    
    <div class="status-grid">
      <div class="status-card">
        <h3>Server Status</h3>
        <div>
          <span class="badge success">✓ Active</span>
          <span class="badge info">OAuth 2.1</span>
          <span class="badge info">MCP v2024-11-05</span>
        </div>
        <p style="margin-top: 1rem; color: #9ca3af;">
          Server is running and ready to accept connections from Claude.ai
        </p>
      </div>
      
      <div class="status-card">
        <h3>OAuth Status</h3>
        <div>
          <span class="badge ${clients.size > 0 ? 'success' : 'warning'}">
            ${clients.size} Registered Clients
          </span>
          <span class="badge ${tokens.size > 0 ? 'info' : 'warning'}">
            ${tokens.size} Active Tokens
          </span>
          <span class="badge ${authCodes.size > 0 ? 'info' : 'warning'}">
            ${authCodes.size} Pending Auth Codes
          </span>
        </div>
      </div>
      
      <div class="status-card">
        <h3>Environment Status</h3>
        <div>
          <span class="badge ${process.env.INFLUXDB_URL ? 'success' : 'error'}">
            ${process.env.INFLUXDB_URL ? '✓' : '✗'} INFLUXDB_URL
          </span>
          <span class="badge ${process.env.INFLUXDB_TOKEN ? 'success' : 'error'}">
            ${process.env.INFLUXDB_TOKEN ? '✓' : '✗'} INFLUXDB_TOKEN
          </span>
        </div>
      </div>
    </div>
    
    <h2>Available MCP Tools</h2>
    <div class="tool-grid">
      <div class="tool-card">
        <h4>write_data</h4>
        <p>Write time-series data to InfluxDB using line protocol format</p>
      </div>
      <div class="tool-card">
        <h4>query_data</h4>
        <p>Execute Flux queries against InfluxDB to retrieve time-series data</p>
      </div>
      <div class="tool-card">
        <h4>create_bucket</h4>
        <p>Create a new bucket in InfluxDB for storing time-series data</p>
      </div>
      <div class="tool-card">
        <h4>create_org</h4>
        <p>Create a new organization in InfluxDB</p>
      </div>
    </div>
    
    <h2>OAuth 2.1 Endpoints</h2>
    <ul class="endpoint-list">
      <li>
        <span class="method get">GET</span>
        <code>${baseUrl}/.well-known/oauth-authorization-server</code>
        - OAuth metadata
      </li>
      <li>
        <span class="method get">GET</span>
        <code>${baseUrl}/.well-known/oauth-protected-resource</code>
        - Resource metadata
      </li>
      <li>
        <span class="method post">POST</span>
        <code>${baseUrl}/api/oauth/register</code>
        - Dynamic client registration
      </li>
      <li>
        <span class="method get">GET</span>
        <code>${baseUrl}/api/oauth/authorize</code>
        - Authorization endpoint
      </li>
      <li>
        <span class="method post">POST</span>
        <code>${baseUrl}/api/oauth/token</code>
        - Token endpoint
      </li>
    </ul>
    
    <h2>MCP Endpoints</h2>
    <ul class="endpoint-list">
      <li>
        <span class="method post">POST</span>
        <code>${baseUrl}/mcp</code>
        - Streamable HTTP (preferred)
      </li>
      <li>
        <span class="method get">GET</span>
        <code>${baseUrl}/sse</code>
        - Server-Sent Events
      </li>
      <li>
        <span class="method post">POST</span>
        <code>${baseUrl}/messages</code>
        - Standard JSON-RPC
      </li>
    </ul>
    
    <div class="debug-section">
      <h3>🔍 Debugging Information</h3>
      <p>If tools are not appearing in Claude.ai, check:</p>
      <ol style="margin-left: 2rem; margin-top: 1rem;">
        <li>Tool names must only contain <code>[a-zA-Z0-9_-]</code> characters (no spaces!)</li>
        <li>OAuth flow must complete successfully</li>
        <li>Session must be established within 10 seconds</li>
        <li>All environment variables must be set in Vercel</li>
      </ol>
      
      <h4 style="margin-top: 1.5rem;">Test OAuth Flow:</h4>
      <pre>curl -X POST ${baseUrl}/api/oauth/register \\
  -H "Content-Type: application/json" \\
  -d '{"client_name": "Test Client", "redirect_uris": ["https://claude.ai/callback"]}'</pre>
      
      <h4 style="margin-top: 1.5rem;">Test MCP Connection:</h4>
      <pre>curl -X POST ${baseUrl}/mcp \\
  -H "Content-Type: application/json" \\
  -H "Accept: text/event-stream" \\
  -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'</pre>
    </div>
    
    <div class="footer">
      <p>
        <a href="https://github.com/frescales/influxdb-mcp-server" target="_blank">
          View on GitHub
        </a>
        |
        <a href="https://modelcontextprotocol.io" target="_blank">
          MCP Documentation
        </a>
        |
        Built with 💜 for Claude.ai
      </p>
    </div>
  </div>
</body>
</html>
  `;
  
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
}
