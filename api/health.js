// Simple health check endpoint
export default function handler(req, res) {
  res.status(200).json({ 
    status: 'ok',
    message: 'InfluxDB MCP Server is running',
    endpoint: '/api/mcp',
    method: 'POST only'
  });
}
