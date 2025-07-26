// OAuth 2.1 Dynamic Client Registration Endpoint
// Required by MCP specification for Claude.ai

import { clients, generateToken } from '../../oauth-config.js';

export default function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const {
      client_name,
      redirect_uris = [],
      grant_types = ['authorization_code'],
      response_types = ['code'],
      scope,
      contacts,
      logo_uri,
      client_uri,
      policy_uri,
      tos_uri,
      software_id,
      software_version
    } = req.body;
    
    // Validate required fields
    if (!client_name) {
      return res.status(400).json({
        error: 'invalid_client_metadata',
        error_description: 'client_name is required'
      });
    }
    
    // Generate client credentials
    const clientId = `influxdb_mcp_${generateToken(16)}`;
    const clientSecret = generateToken(32);
    
    // Get base URL
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const baseUrl = `${protocol}://${host}`;
    
    // Create client registration
    const client = {
      client_id: clientId,
      client_secret: clientSecret,
      client_name,
      redirect_uris,
      grant_types,
      response_types,
      scope: scope || 'mcp:tools mcp:resources influxdb:read influxdb:write',
      
      // Optional metadata
      contacts,
      logo_uri,
      client_uri,
      policy_uri,
      tos_uri,
      software_id: software_id || 'influxdb-mcp-server',
      software_version: software_version || '1.0.0',
      
      // Registration metadata
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_secret_expires_at: 0, // Never expires
      
      // MCP specific
      token_endpoint_auth_method: 'none', // Public client for Claude.ai
      
      // Additional URLs
      registration_client_uri: `${baseUrl}/api/oauth/clients/${clientId}`,
      registration_access_token: generateToken(32)
    };
    
    // Store client
    clients.set(clientId, client);
    
    // Return registration response
    res.status(201).json({
      client_id: client.client_id,
      client_secret: client.client_secret,
      client_name: client.client_name,
      redirect_uris: client.redirect_uris,
      grant_types: client.grant_types,
      response_types: client.response_types,
      scope: client.scope,
      token_endpoint_auth_method: client.token_endpoint_auth_method,
      client_id_issued_at: client.client_id_issued_at,
      client_secret_expires_at: client.client_secret_expires_at,
      registration_client_uri: client.registration_client_uri,
      registration_access_token: client.registration_access_token
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error during registration'
    });
  }
}
