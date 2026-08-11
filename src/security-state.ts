import { Env } from './types';
import type { RateLimitResult } from './middleware/rate-limiter';

interface RateLimitRequest {
  now: number;
  maxRequests: number;
  windowSeconds: number;
}

interface RateLimitState {
  window: number;
  count: number;
}

interface OAuthCodeRecord {
  clientId?: string;
  codeChallenge?: string;
  expiresAt?: number;
  [key: string]: unknown;
}

/**
 * Strongly consistent storage for one-time OAuth codes and rate-limit
 * counters. Callers address a separate object per code or client, so requests
 * for the same security principal are serialized by Cloudflare.
 */
export class SecurityState {
  constructor(
    private readonly state: DurableObjectState,
    _env: Env
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/oauth-code' && request.method === 'PUT') {
      const data = await request.text();
      await this.state.storage.put('oauth-code', data);
      await this.state.storage.setAlarm(Date.now() + 10 * 60 * 1000);
      return new Response(null, { status: 204 });
    }

    if (url.pathname === '/oauth-code/consume' && request.method === 'POST') {
      const credentials = await request.json<{ clientId: string; codeChallenge: string }>();
      const result = await this.state.storage.transaction(async transaction => {
        const stored = await transaction.get<string>('oauth-code');
        if (stored === undefined) {
          return { status: 'missing' as const };
        }

        const record = JSON.parse(stored) as OAuthCodeRecord;
        if (typeof record.expiresAt !== 'number' || record.expiresAt < Date.now()) {
          await transaction.delete('oauth-code');
          return { status: 'missing' as const };
        }
        if (
          record.clientId !== credentials.clientId ||
          record.codeChallenge !== credentials.codeChallenge
        ) {
          return { status: 'mismatch' as const };
        }

        await transaction.delete('oauth-code');
        return { status: 'consumed' as const, stored };
      });

      if (result.status === 'missing') {
        return new Response(null, { status: 404 });
      }
      if (result.status === 'mismatch') {
        return new Response(null, { status: 403 });
      }
      return new Response(result.stored, {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (url.pathname === '/rate-limit' && request.method === 'POST') {
      const body = await request.json<RateLimitRequest>();
      const result = await this.checkRateLimit(body);
      return Response.json(result);
    }

    return new Response('Not Found', { status: 404 });
  }

  async alarm(): Promise<void> {
    await this.state.storage.deleteAll();
  }

  private async checkRateLimit(request: RateLimitRequest): Promise<RateLimitResult> {
    const window = Math.floor(request.now / (request.windowSeconds * 1000));
    const resetAt = (window + 1) * request.windowSeconds;

    return this.state.storage.transaction(async transaction => {
      const stored = await transaction.get<RateLimitState>('rate-limit');
      const count = stored?.window === window ? stored.count : 0;

      if (count >= request.maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          limit: request.maxRequests,
          resetAt,
          retryAfter: Math.max(1, resetAt - Math.floor(request.now / 1000))
        };
      }

      const nextCount = count + 1;
      await transaction.put('rate-limit', { window, count: nextCount });
      return {
        allowed: true,
        remaining: request.maxRequests - nextCount,
        limit: request.maxRequests,
        resetAt
      };
    });
  }
}
