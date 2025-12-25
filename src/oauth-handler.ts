import { Env, AuthSession } from './types';
import { AuthManager, AuthError } from './auth';

export class OAuthHandler {
  addSecurityHeaders(response: Response): Response {
    const headers = new Headers(response.headers);
    
    // Security headers
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('X-XSS-Protection', '1; mode=block');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('Content-Security-Policy', "default-src 'none'; script-src 'none'; style-src 'none';");
    
    // CORS headers
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Last-Event-ID, Mcp-Session-Id, Authorization');
    headers.set('Access-Control-Max-Age', '86400');
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  async handleAuthorize(_request: Request, env: Env): Promise<Response> {
    try {
      const authManager = new AuthManager(env);
      
      // Generate state for CSRF protection
      const state = authManager.generateState();
      const authUrl = authManager.generateAuthURL(state);
      
      // In production, you'd store the state in a secure way (KV, session, etc.)
      // For now, we'll include it in the redirect
      
      return Response.redirect(authUrl, 302);
    } catch (error) {
      return new Response(
        error instanceof AuthError ? error.message : 'OAuth configuration error',
        { status: error instanceof AuthError ? error.status : 500 }
      );
    }
  }

  async handleToken(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }
    
    try {
      const authManager = new AuthManager(env);
      const body = await request.formData();
      const grantType = body.get('grant_type');
      const code = body.get('code');
      
      if (grantType !== 'authorization_code' || !code) {
        return new Response(JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Grant type must be authorization_code and code is required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Exchange code for GitHub access token
      const githubAccessToken = await authManager.exchangeCodeForToken(code.toString());
      
      // Get user info from GitHub
      const user = await authManager.getUserInfo(githubAccessToken);
      
      // Create session (expires in 90 days)
      const expiresAt = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60);
      const session: AuthSession = {
        userId: user.id,
        userLogin: user.login,
        expiresAt
      };
      
      // Generate JWT token
      const jwtToken = await authManager.generateJWT(session);
      
      return this.addSecurityHeaders(new Response(JSON.stringify({
        access_token: jwtToken,
        token_type: 'Bearer',
        expires_in: 90 * 24 * 60 * 60,
        user: {
          login: user.login,
          name: user.name
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      }));
    } catch (error) {
      const errorMessage = error instanceof AuthError ? error.message : 'Token exchange failed';
      const statusCode = error instanceof AuthError ? error.status : 400;
      
      return this.addSecurityHeaders(new Response(JSON.stringify({
        error: 'invalid_request',
        error_description: errorMessage
      }), {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' }
      }));
    }
  }

  async handleRegister(request: Request, _env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }
    
    try {
      const body = await request.json() as { client_name?: string; redirect_uris?: string[] };
      const { client_name, redirect_uris } = body;
      
      if (!client_name || !redirect_uris) {
        return new Response('Missing required fields', { status: 400 });
      }
      
      // For demo purposes, generate a dummy client
      const clientId = 'wmata_client_' + Date.now();
      const clientSecret = 'wmata_secret_' + Math.random().toString(36);
      
      return new Response(JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        client_name,
        redirect_uris
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      return new Response('Invalid request', { status: 400 });
    }
  }

  async handleCallback(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    // Note: state parameter available for CSRF protection if needed
    
    if (error) {
      return this.addSecurityHeaders(new Response(`
        <html>
          <head><title>Metro MCP - OAuth Error</title></head>
          <body>
            <h1>Authorization Failed</h1>
            <p>Error: ${error}</p>
            <p>Please try again or contact support.</p>
          </body>
        </html>
      `, {
        status: 400,
        headers: { 'Content-Type': 'text/html' }
      }));
    }
    
    if (!code) {
      return this.addSecurityHeaders(new Response(`
        <html>
          <head><title>Metro MCP - OAuth Error</title></head>
          <body>
            <h1>Authorization Failed</h1>
            <p>No authorization code received.</p>
          </body>
        </html>
      `, {
        status: 400,
        headers: { 'Content-Type': 'text/html' }
      }));
    }
    
    try {
      const authManager = new AuthManager(env);
      
      // Exchange code for token (this creates a complete authentication flow)
      const githubAccessToken = await authManager.exchangeCodeForToken(code);
      const user = await authManager.getUserInfo(githubAccessToken);
      
      // Create session
      const expiresAt = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60);
      const session: AuthSession = {
        userId: user.id,
        userLogin: user.login,
        expiresAt
      };
      
      const jwtToken = await authManager.generateJWT(session);
      
      return this.addSecurityHeaders(new Response(`
        <html>
          <head><title>Metro MCP - OAuth Success</title></head>
          <body>
            <h1>Authorization Successful!</h1>
            <p>Welcome, <strong>${user.name || user.login}</strong>!</p>
            <p>Your access token:</p>
            <textarea rows="4" cols="80" readonly>${jwtToken}</textarea>
            <p>Copy this token and use it in your MCP client with the Authorization header:</p>
            <code>Authorization: Bearer ${jwtToken}</code>
            <p>Token expires in 90 days.</p>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      }));
    } catch (error) {
      return this.addSecurityHeaders(new Response(`
        <html>
          <head><title>Metro MCP - OAuth Error</title></head>
          <body>
            <h1>Authorization Failed</h1>
            <p>Error processing authorization: ${error instanceof Error ? error.message : 'Unknown error'}</p>
          </body>
        </html>
      `, {
        status: 500,
        headers: { 'Content-Type': 'text/html' }
      }));
    }
  }
}