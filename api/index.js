// MCP Server endpoint for Claude.ai
// This handles the initial connection
export default function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Return the MCP server endpoint
  res.status(200).json({
    endpoint: "https://influxdb-mcp-server.vercel.app/api/mcp",
    transport: "sse"
  });
}