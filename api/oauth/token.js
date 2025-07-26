// OAuth 2.1 Token Endpoint
// Handles token exchange for Claude.ai

import { authCodes, tokens, validatePKCEChallenge, generateToken } from '../../oauth-config.js';

export default async function handler(req, res) {
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
      grant_type,
      code,
      redirect_uri,
      client_id,
      code_verifier,
      refresh_token
    } = req.body;
    
    // Validate grant type
    if (!grant_type || !['authorization_code', 'refresh_token'].includes(grant_type)) {
      return res.status(400).json({
        error: 'unsupported_grant_type',
        error_description: 'Only authorization_code and refresh_token grants are supported'
      });
    }
    
    if (grant_type === 'authorization_code') {
      // Validate required parameters
      if (!code) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'code is required'
        });
      }
      
      if (!code_verifier) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'code_verifier is required for PKCE'
        });
      }
      
      // Retrieve and validate authorization code
      const authCode = authCodes.get(code);
      if (!authCode) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Invalid authorization code'
        });
      }
      
      // Check if code is expired
      if (Date.now() > authCode.expires_at) {
        authCodes.delete(code);
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Authorization code has expired'
        });
      }
      
      // Check if code was already used
      if (authCode.used) {
        authCodes.delete(code);
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Authorization code has already been used'
        });
      }
      
      // Validate client_id
      if (client_id && client_id !== authCode.client_id) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Client ID mismatch'
        });
      }
      
      // Validate redirect_uri
      if (redirect_uri && redirect_uri !== authCode.redirect_uri) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Redirect URI mismatch'
        });
      }
      
      // Validate PKCE
      const isValidPKCE = await validatePKCEChallenge(
        code_verifier,
        authCode.code_challenge,
        authCode.code_challenge_method
      );
      
      if (!isValidPKCE) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'PKCE verification failed'
        });
      }
      
      // Mark code as used
      authCode.used = true;
      authCodes.set(code, authCode);
      
      // Generate tokens
      const accessToken = generateToken(32);
      const refreshToken = generateToken(32);
      
      // Store token data
      const tokenData = {
        access_token: accessToken,
        refresh_token: refreshToken,
        client_id: authCode.client_id,
        scope: authCode.scope,
        expires_at: Date.now() + 3600000, // 1 hour
        token_type: 'Bearer'
      };
      
      tokens.set(accessToken, tokenData);
      tokens.set(refreshToken, {
        ...tokenData,
        is_refresh_token: true,
        expires_at: Date.now() + 2592000000 // 30 days
      });
      
      // Clean up used authorization code
      authCodes.delete(code);
      
      // Return token response
      return res.status(200).json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: refreshToken,
        scope: authCode.scope
      });
    }
    
    if (grant_type === 'refresh_token') {
      if (!refresh_token) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'refresh_token is required'
        });
      }
      
      const tokenData = tokens.get(refresh_token);
      if (!tokenData || !tokenData.is_refresh_token) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Invalid refresh token'
        });
      }
      
      if (Date.now() > tokenData.expires_at) {
        tokens.delete(refresh_token);
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Refresh token has expired'
        });
      }
      
      // Generate new access token
      const newAccessToken = generateToken(32);
      const newTokenData = {
        access_token: newAccessToken,
        refresh_token: refresh_token,
        client_id: tokenData.client_id,
        scope: tokenData.scope,
        expires_at: Date.now() + 3600000,
        token_type: 'Bearer'
      };
      
      tokens.set(newAccessToken, newTokenData);
      
      return res.status(200).json({
        access_token: newAccessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: refresh_token,
        scope: tokenData.scope
      });
    }
    
  } catch (error) {
    console.error('Token error:', error);
    return res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error'
    });
  }
}
