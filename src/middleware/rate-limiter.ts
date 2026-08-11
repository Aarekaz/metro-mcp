import { Env } from '../types';

/**
 * Rate Limiting Configuration
 * 
 * WHY: Different endpoints have different rate limit requirements:
 * - OAuth endpoints need higher limits for authorization flows
 * - MCP endpoints are the main API and need standard protection
 * - Static endpoints can have lower limits
 * 
 * Counters live in Durable Objects because KV read/modify/write operations are
 * not atomic. One object per client and endpoint tier serializes concurrent
 * requests without turning unrelated clients into a global bottleneck.
 */
export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Tier name for logging/debugging */
  tier: 'free' | 'premium' | 'oauth';
}

/**
 * Rate limit result returned to callers
 * Includes all information needed for proper HTTP headers
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of requests remaining in current window */
  remaining: number;
  /** Maximum requests allowed per window */
  limit: number;
  /** Unix timestamp when the rate limit resets */
  resetAt: number;
  /** Number of seconds until reset */
  retryAfter?: number;
}

/**
 * Default rate limit tiers
 * 
 * WHY THESE NUMBERS:
 * - Free tier (100/min): Generous for individuals, prevents abuse
 * - OAuth (200/min): Higher because auth flows need multiple requests
 * 
 * FUTURE: These could be moved to environment variables or
 * loaded from KV/configuration service for dynamic adjustment
 */
const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  mcp: {
    maxRequests: 100,
    windowSeconds: 60,
    tier: 'free'
  },
  oauth: {
    maxRequests: 200,
    windowSeconds: 60,
    tier: 'oauth'
  },
  static: {
    maxRequests: 50,
    windowSeconds: 60,
    tier: 'free'
  }
};

/**
 * Rate limiter backed by the SECURITY_STATE Durable Object namespace.
 * 
 * The Durable Object owns the fixed-window counter and updates it inside a
 * storage transaction. Infrastructure failures fail open for availability and
 * are logged so production monitoring can catch the protection gap.
 */
export class RateLimiter {
  private env: Env;
  private config: RateLimitConfig;
  private configName: string;

  constructor(env: Env, configName: string = 'mcp') {
    this.env = env;
    this.configName = DEFAULT_CONFIGS[configName] ? configName : 'mcp';
    this.config = DEFAULT_CONFIGS[this.configName]!;
  }

  /**
   * Check if a request should be allowed based on rate limits
   * 
   * @param clientId - Unique identifier for the client (usually IP address)
   * @returns Rate limit result with allow/deny decision and metadata
   * 
   * WHY CLIENT ID:
   * We use IP address as the default identifier because:
   * - Available for all requests
   * - Reasonably unique per user
   * - Survives authentication failures
   * 
   * FUTURE ENHANCEMENT:
   * Could use authenticated user ID for better accuracy,
   * but IP works well for protecting against unauthenticated abuse
   */
  async checkLimit(clientId: string): Promise<RateLimitResult> {
    const now = Date.now();

    try {
      const id = this.env.SECURITY_STATE.idFromName(
        `rate-limit:${this.configName}:${clientId}`
      );
      const response = await this.env.SECURITY_STATE.get(id).fetch(
        'https://security-state/rate-limit',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            now,
            maxRequests: this.config.maxRequests,
            windowSeconds: this.config.windowSeconds
          })
        }
      );

      if (!response.ok) {
        throw new Error(`SecurityState returned ${response.status}`);
      }

      return response.json<RateLimitResult>();
    } catch (error) {
      // IMPORTANT: Fail open on coordination errors
      // WHY: Availability over strict rate limiting
      // If coordination is down, we'd rather serve requests than block traffic
      // Log the error for monitoring/alerting
      console.error('Rate limiter error:', error);
      
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        limit: this.config.maxRequests,
        resetAt: Math.floor(now / 1000) + this.config.windowSeconds
      };
    }
  }

  /**
   * Extract client identifier from request
   * 
   * WHY THIS ORDER:
   * 1. CF-Connecting-IP: Most reliable, set by Cloudflare
   * 2. X-Real-IP: Common proxy header
   * 3. X-Forwarded-For: Standard but can be spoofed (take first IP)
   * 4. 'unknown': Fallback to prevent crashes
   * 
   * SECURITY NOTE:
   * In Cloudflare Workers, CF-Connecting-IP is trustworthy because
   * Cloudflare sets it and can't be spoofed by clients
   */
  static getClientId(request: Request): string {
    return (
      request.headers.get('CF-Connecting-IP') ||
      request.headers.get('X-Real-IP') ||
      request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
      'unknown'
    );
  }

  /**
   * Add rate limit headers to a response
   * 
   * WHY THESE HEADERS:
   * - X-RateLimit-Limit: Helps clients understand limits
   * - X-RateLimit-Remaining: Enables smart client-side throttling
   * - X-RateLimit-Reset: Tells clients when to retry
   * - Retry-After: Standard HTTP header for rate limit exceeded
   * 
   * STANDARDS:
   * Following RFC 6585 and common industry practices
   * (GitHub, Twitter, Stripe all use similar headers)
   */
  static addRateLimitHeaders(response: Response, result: RateLimitResult): Response {
    const headers = new Headers(response.headers);
    
    headers.set('X-RateLimit-Limit', result.limit.toString());
    headers.set('X-RateLimit-Remaining', result.remaining.toString());
    headers.set('X-RateLimit-Reset', result.resetAt.toString());
    
    if (result.retryAfter) {
      headers.set('Retry-After', result.retryAfter.toString());
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
}

/**
 * Middleware function to apply rate limiting to requests
 * 
 * USAGE:
 * ```typescript
 * const result = await applyRateLimit(request, env, 'mcp');
 * if (!result.allowed) {
 *   return createRateLimitResponse(result);
 * }
 * ```
 * 
 * WHY SEPARATE FUNCTION:
 * Makes it easy to apply consistent rate limiting across routes
 * without duplicating logic
 */
export async function applyRateLimit(
  request: Request,
  env: Env,
  configName: string = 'mcp'
): Promise<RateLimitResult> {
  const clientId = RateLimiter.getClientId(request);
  const limiter = new RateLimiter(env, configName);
  return limiter.checkLimit(clientId);
}

/**
 * Create a standardized rate limit exceeded response
 * 
 * WHY JSON-RPC FORMAT:
 * For MCP endpoints, we need to respond in JSON-RPC 2.0 format
 * For other endpoints, standard HTTP 429 is fine
 * 
 * STATUS CODE 429:
 * Standard HTTP status for "Too Many Requests" (RFC 6585)
 */
export function createRateLimitResponse(result: RateLimitResult, jsonRpc: boolean = true): Response {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': '0',
    'X-RateLimit-Reset': result.resetAt.toString(),
  };

  if (result.retryAfter) {
    headers['Retry-After'] = result.retryAfter.toString();
  }

  if (jsonRpc) {
    headers['Content-Type'] = 'application/json';
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32603,
          message: 'Too Many Requests',
          data: {
            error: 'rate_limit_exceeded',
            message: `Rate limit exceeded. Maximum ${result.limit} requests per minute.`,
            retryAfter: result.retryAfter,
            resetAt: result.resetAt
          }
        }
      }),
      { status: 429, headers }
    );
  }

  headers['Content-Type'] = 'text/plain';
  return new Response(
    `Rate limit exceeded. Please try again in ${result.retryAfter} seconds.`,
    { status: 429, headers }
  );
}
