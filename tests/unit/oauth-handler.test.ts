import { beforeEach, describe, expect, it } from 'vitest';
import { OAuthHandler } from '../../src/oauth-handler';
import { createMockEnv } from '../setup';
import type { Env } from '../../src/types';

async function pkceChallenge(verifier: string): Promise<string> {
  const hash = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  );
  return btoa(String.fromCharCode(...hash))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

describe('OAuthHandler', () => {
  let env: Env;
  let handler: OAuthHandler;

  beforeEach(() => {
    env = createMockEnv();
    handler = new OAuthHandler();
  });

  async function seedCode(code: string, clientId: string, verifier: string): Promise<void> {
    const id = env.SECURITY_STATE.idFromName(`oauth-code:${code}`);
    await env.SECURITY_STATE.get(id).fetch('https://security-state/oauth-code', {
      method: 'PUT',
      body: JSON.stringify({
        userId: '123',
        userLogin: 'metro-user',
        clientId,
        codeChallenge: await pkceChallenge(verifier),
        expiresAt: Date.now() + 60_000
      })
    });
  }

  function tokenRequest(
    code: string,
    verifier: string,
    clientId?: string
  ): Request {
    return new Request('https://metro-mcp.example/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        code_verifier: verifier,
        ...(clientId ? { client_id: clientId } : {})
      })
    });
  }

  it('escapes callback errors and blocks inline scripts', async () => {
    const payload = '<script>document.body.dataset.pwned="yes"</script>';
    const response = await handler.handleCallback(
      new Request(`https://metro-mcp.example/callback?error=${encodeURIComponent(payload)}`),
      env
    );
    const body = await response.text();

    expect(body).not.toContain(payload);
    expect(body).toContain('&lt;script&gt;');
    expect(response.headers.get('Content-Security-Policy')).toContain("script-src 'none'");
  });

  it('requires client_id during token exchange', async () => {
    const response = await handler.handleToken(tokenRequest('code', 'verifier'), env);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error_description: 'client_id is required'
    });
  });

  it('does not consume a code when client or PKCE verification fails', async () => {
    await seedCode('retryable', 'client-a', 'correct-verifier');

    const rejected = await handler.handleToken(
      tokenRequest('retryable', 'wrong-verifier', 'client-a'),
      env
    );
    const accepted = await handler.handleToken(
      tokenRequest('retryable', 'correct-verifier', 'client-a'),
      env
    );

    expect(rejected.status).toBe(400);
    expect(accepted.status).toBe(200);
  });

  it('allows exactly one concurrent redemption of an authorization code', async () => {
    await seedCode('single-use', 'client-a', 'correct-verifier');

    const responses = await Promise.all([
      handler.handleToken(tokenRequest('single-use', 'correct-verifier', 'client-a'), env),
      handler.handleToken(tokenRequest('single-use', 'correct-verifier', 'client-a'), env)
    ]);

    expect(responses.map(response => response.status).sort()).toEqual([200, 400]);
  });

  it('registers public PKCE clients without issuing an unused secret', async () => {
    const response = await handler.handleRegister(
      new Request('https://metro-mcp.example/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: 'Test client',
          redirect_uris: ['https://client.example/callback']
        })
      }),
      env
    );
    const registration = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(registration.client_secret).toBeUndefined();
    expect(registration.token_endpoint_auth_method).toBe('none');
  });
});
