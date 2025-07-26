// OAuth 2.1 Configuration for Claude.ai MCP Server
// Required for remote MCP servers per MCP specification

export const OAUTH_CONFIG = {
  // OAuth endpoints
  authorizationEndpoint: '/api/oauth/authorize',
  tokenEndpoint: '/api/oauth/token',
  registrationEndpoint: '/api/oauth/register',
  
  // OAuth metadata endpoint (required by MCP spec)
  metadataEndpoint: '/.well-known/oauth-authorization-server',
  
  // Protected resource metadata (required for MCP)
  protectedResourceEndpoint: '/.well-known/oauth-protected-resource',
  
  // OAuth 2.1 requirements
  requirePKCE: true,
  supportedResponseTypes: ['code'],
  supportedGrantTypes: ['authorization_code', 'refresh_token'],
  
  // Token settings
  accessTokenLifetime: 3600, // 1 hour
  refreshTokenLifetime: 2592000, // 30 days
  
  // Supported scopes for MCP
  supportedScopes: [
    'mcp:tools',
    'mcp:resources',
    'mcp:prompts',
    'influxdb:read',
    'influxdb:write'
  ],
  
  // Client configuration
  clientRegistrationRequired: true,
  dynamicClientRegistration: true,
  
  // Security settings
  requireStateParameter: true,
  allowPublicClients: true, // Required for Claude.ai
  
  // CORS origins
  allowedOrigins: [
    'https://claude.ai',
    'https://*.claude.ai',
    'https://www.anthropic.com',
    'https://*.anthropic.com'
  ]
};

// Generate cryptographically secure tokens
export function generateToken(length = 32) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Validate PKCE challenge
export function validatePKCEChallenge(verifier, challenge, method = 'S256') {
  if (method === 'S256') {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    return crypto.subtle.digest('SHA-256', data)
      .then(hash => {
        const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
        return base64 === challenge;
      });
  }
  return verifier === challenge;
}

// Session store (in production, use Redis or database)
export const sessions = new Map();
export const clients = new Map();
export const authCodes = new Map();
export const tokens = new Map();
