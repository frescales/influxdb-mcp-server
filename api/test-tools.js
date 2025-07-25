// Test endpoint to verify MCP tools registration
export default async function handler(req, res) {
  // Simulate a tools/list request to the MCP endpoint
  const testRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {}
  };

  try {
    const response = await fetch(new URL('/api/mcp', `https://${req.headers.host}`).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testRequest)
    });

    const data = await response.json();
    
    res.status(200).json({
      status: 'ok',
      endpoint: '/api/mcp',
      request: testRequest,
      response: data,
      toolsCount: data.result?.tools?.length || 0,
      tools: data.result?.tools?.map(t => ({ name: t.name, title: t.title })) || []
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
}
