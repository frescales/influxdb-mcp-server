// OAuth 2.1 Authorization Endpoint
// Handles authorization requests from Claude.ai

import { clients, authCodes, generateToken } from '../../oauth-config.js';

export default function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Handle both GET and POST per OAuth 2.1 spec
  const params = req.method === 'GET' ? req.query : req.body;
  
  try {
    const {
      response_type,
      client_id,
      redirect_uri,
      scope,
      state,
      code_challenge,
      code_challenge_method = 'S256'
    } = params;
    
    // Validate required parameters
    if (!response_type || response_type !== 'code') {
      return res.status(400).json({
        error: 'unsupported_response_type',
        error_description: 'Only authorization code flow is supported'
      });
    }
    
    if (!client_id) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'client_id is required'
      });
    }
    
    if (!redirect_uri) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'redirect_uri is required'
      });
    }
    
    // OAuth 2.1 requires PKCE for public clients
    if (!code_challenge) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'PKCE code_challenge is required for public clients'
      });
    }
    
    // Validate client
    const client = clients.get(client_id);
    if (!client) {
      // For Claude.ai, auto-register unknown clients
      const newClient = {
        client_id,
        client_name: 'Claude.ai',
        redirect_uris: [redirect_uri],
        grant_types: ['authorization_code'],
        response_types: ['code'],
        scope: 'mcp:tools mcp:resources influxdb:read influxdb:write',
        token_endpoint_auth_method: 'none'
      };
      clients.set(client_id, newClient);
    }
    
    // Generate authorization code
    const code = generateToken(32);
    const authCodeData = {
      client_id,
      redirect_uri,
      scope: scope || 'mcp:tools mcp:resources influxdb:read influxdb:write',
      code_challenge,
      code_challenge_method,
      expires_at: Date.now() + 600000, // 10 minutes
      used: false
    };
    
    authCodes.set(code, authCodeData);
    
    // Build redirect URL
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', code);
    if (state) {
      redirectUrl.searchParams.set('state', state);
    }
    
    // Get base URL for iss parameter (required by OAuth 2.1)
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const issuer = `${protocol}://${host}`;
    redirectUrl.searchParams.set('iss', issuer);
    
    // For web-based flows, return HTML with auto-redirect
    if (req.headers.accept?.includes('text/html')) {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Authorization Successful</title>
          <meta http-equiv="refresh" content="0;url=${redirectUrl.toString()}">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: #f5f5f5;
            }
            .container {
              text-align: center;
              padding: 2rem;
              background: white;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            h1 { color: #333; }
            p { color: #666; }
            a { color: #0066cc; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Authorization Successful</h1>
            <p>Redirecting to Claude.ai...</p>
            <p>If you are not redirected automatically, <a href="${redirectUrl.toString()}">click here</a>.</p>
          </div>
          <script>
            window.location.href = "${redirectUrl.toString()}";
          </script>
        </body>
        </html>
      `;
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);
    }
    
    // For API calls, return 302 redirect
    res.setHeader('Location', redirectUrl.toString());
    return res.status(302).end();
    
  } catch (error) {
    console.error('Authorization error:', error);
    return res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error'
    });
  }
}
