// OAuth 2.1 Protected Resource Metadata Endpoint
// Required by MCP specification for resource servers

export default function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Get the base URL from the request
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const baseUrl = `${protocol}://${host}`;
  
  // OAuth 2.1 Protected Resource Metadata
  // Per draft-ietf-oauth-resource-metadata
  const metadata = {
    resource: baseUrl,
    authorization_servers: [`${baseUrl}/.well-known/oauth-authorization-server`],
    
    // MCP specific resource types
    resource_documentation: 'https://github.com/frescales/influxdb-mcp-server',
    
    // Bearer token usage
    bearer_methods_supported: ['header'],
    
    // Resource capabilities
    resource_signing_alg_values_supported: ['none'],
    
    // Scopes required for different operations
    scopes_supported: [
      {
        name: 'mcp:tools',
        description: 'Access to MCP tools for InfluxDB operations'
      },
      {
        name: 'mcp:resources',
        description: 'Access to MCP resources for listing organizations and buckets'
      },
      {
        name: 'mcp:prompts',
        description: 'Access to MCP prompts'
      },
      {
        name: 'influxdb:read',
        description: 'Read access to InfluxDB data'
      },
      {
        name: 'influxdb:write',
        description: 'Write access to InfluxDB data'
      }
    ],
    
    // UI metadata
    ui_locales_supported: ['en'],
    
    // Service metadata
    service_documentation: baseUrl,
    op_policy_uri: `${baseUrl}/privacy`,
    op_tos_uri: `${baseUrl}/terms`
  };
  
  return res.status(200).json(metadata);
}
