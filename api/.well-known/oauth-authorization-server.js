// OAuth 2.1 Authorization Server Metadata Endpoint
// Required by MCP specification for remote servers

import { OAUTH_CONFIG } from '../oauth-config.js';

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
  
  // OAuth 2.1 Authorization Server Metadata
  // Per RFC 8414 and MCP requirements
  const metadata = {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}${OAUTH_CONFIG.authorizationEndpoint}`,
    token_endpoint: `${baseUrl}${OAUTH_CONFIG.tokenEndpoint}`,
    registration_endpoint: `${baseUrl}${OAUTH_CONFIG.registrationEndpoint}`,
    
    // Required for MCP
    mcp_endpoint: `${baseUrl}/mcp`,
    
    // OAuth 2.1 requirements
    response_types_supported: OAUTH_CONFIG.supportedResponseTypes,
    grant_types_supported: OAUTH_CONFIG.supportedGrantTypes,
    
    // PKCE is mandatory for OAuth 2.1
    code_challenge_methods_supported: ['S256', 'plain'],
    
    // Token endpoint auth methods
    token_endpoint_auth_methods_supported: ['none'], // Public clients
    
    // Scopes
    scopes_supported: OAUTH_CONFIG.supportedScopes,
    
    // Additional OAuth 2.1 features
    revocation_endpoint: `${baseUrl}/api/oauth/revoke`,
    introspection_endpoint: `${baseUrl}/api/oauth/introspect`,
    
    // Security features
    require_pushed_authorization_requests: false,
    authorization_response_iss_parameter_supported: true,
    
    // MCP specific metadata
    service_documentation: 'https://github.com/frescales/influxdb-mcp-server',
    ui_locales_supported: ['en'],
    
    // Dynamic client registration
    client_registration_types_supported: ['automatic'],
    request_parameter_supported: false,
    request_uri_parameter_supported: false
  };
  
  return res.status(200).json(metadata);
}
