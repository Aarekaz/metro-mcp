import { describe, expect, it, vi } from 'vitest';
import { createMockEnv } from '../setup';
import { Router } from '../../src/router';

describe('Router', () => {
  it('enforces the production request-path rate limiter', async () => {
    const env = createMockEnv({
      ASSETS: { fetch: vi.fn().mockResolvedValue(new Response('asset')) } as unknown as Fetcher
    });
    const router = new Router();
    const makeRequest = () => new Request('https://metro-mcp.example/', {
      headers: { 'CF-Connecting-IP': '203.0.113.10' }
    });

    for (let index = 0; index < 50; index += 1) {
      expect((await router.handleRequest(makeRequest(), env, {} as ExecutionContext)).status).toBe(200);
    }

    const blocked = await router.handleRequest(makeRequest(), env, {} as ExecutionContext);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBeTruthy();
  });

  it('advertises only implemented OAuth grants and authentication methods', async () => {
    const response = await new Router().handleRequest(
      new Request('https://metro-mcp.example/.well-known/oauth-authorization-server', {
        headers: { 'CF-Connecting-IP': '203.0.113.11' }
      }),
      createMockEnv(),
      {} as ExecutionContext
    );
    const metadata = await response.json() as {
      grant_types_supported: string[];
      token_endpoint_auth_methods_supported: string[];
    };

    expect(metadata.grant_types_supported).toEqual(['authorization_code']);
    expect(metadata.token_endpoint_auth_methods_supported).toEqual(['none']);
  });
});
