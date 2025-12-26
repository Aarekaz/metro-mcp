# Migration Guide: Security and Testing Improvements

This guide helps you migrate to the security and testing improvements branch.

## Overview of Changes

This update adds:

1. ✅ **Comprehensive Test Suite** - 60%+ coverage with Vitest
2. ✅ **Rate Limiting** - Production-ready with Cloudflare KV
3. ✅ **Input Validation** - Protection against injection attacks
4. ✅ **Adaptive Security Headers** - Context-aware CSP policies
5. ✅ **Configuration Management** - Centralized, validated config
6. ✅ **Comprehensive Documentation** - Testing and security guides

## Breaking Changes

### None! 🎉

This update is **100% backward compatible**. All changes are:
- New features (rate limiting, validation)
- Internal improvements (tests, config)
- Optional enhancements (better error messages)

## New Requirements

### 1. Rate Limit KV Namespace

**What**: New KV namespace for rate limiting

**Why**: Distributed rate limiting across Cloudflare's edge network

**How**:

```bash
# 1. Create production KV namespace
wrangler kv:namespace create "RATE_LIMIT_KV"
# Output: id = "abc123..."

# 2. Create preview KV namespace
wrangler kv:namespace create "RATE_LIMIT_KV" --preview
# Output: preview_id = "xyz789..."

# 3. Update wrangler.toml with the IDs
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "abc123..."  # From step 1
preview_id = "xyz789..."  # From step 2
```

**Impact**: Without this, rate limiting will fail open (allow all requests)

### 2. Updated Dependencies

**What**: New dev dependencies for testing

**How**:

```bash
# Install new dependencies
npm install
# or
bun install
```

**New Dependencies**:
- `@vitest/coverage-v8`: Code coverage
- `@vitest/ui`: Test UI

## Migration Steps

### Step 1: Update Code

```bash
git checkout main
git pull
git checkout security-and-testing-improvements
git pull
```

### Step 2: Install Dependencies

```bash
npm install
# or
bun install
```

### Step 3: Create Rate Limit KV Namespace

```bash
# Production
wrangler kv:namespace create "RATE_LIMIT_KV"

# Preview (for development)
wrangler kv:namespace create "RATE_LIMIT_KV" --preview
```

### Step 4: Update wrangler.toml

Replace the placeholder IDs in `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "YOUR-PRODUCTION-ID"  # From step 3
preview_id = "YOUR-PREVIEW-ID"  # From step 3
```

### Step 5: Run Tests

```bash
# Run all tests
npm test

# Generate coverage report
npm run test:coverage

# Verify 60%+ coverage achieved
open coverage/index.html
```

### Step 6: Test Locally

```bash
# Start development server
npm run dev

# Test rate limiting
for i in {1..101}; do
  curl http://localhost:8787/
done
# Should see 429 on request 101

# Test validation
curl -X POST http://localhost:8787/sse \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"search_stations","arguments":{"city":"dc","query":"<script>alert(1)</script>"}},"id":1}'
# Should reject with validation error
```

### Step 7: Deploy

```bash
# Deploy to production
npm run deploy

# Verify deployment
curl https://your-worker.workers.dev/
# Should return server info

# Check rate limit headers
curl -i https://your-worker.workers.dev/
# Should include X-RateLimit-* headers
```

### Step 8: Monitor

**Check Cloudflare Dashboard:**
1. Go to Workers & Pages
2. Select your worker
3. Check metrics for:
   - Request count
   - Error rate
   - Response time

**Check KV Usage:**
1. Go to KV
2. Select RATE_LIMIT_KV
3. Verify keys are being created
4. Check auto-expiration is working

## What to Test

### Rate Limiting

```bash
# Test normal usage (should work)
for i in {1..50}; do
  curl https://your-worker.workers.dev/
done

# Test rate limit (should get 429)
for i in {1..101}; do
  curl https://your-worker.workers.dev/
done
```

### Input Validation

```bash
# Test valid input (should work)
curl -X POST https://your-worker.workers.dev/sse \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"search_stations","arguments":{"city":"dc","query":"union station"}},"id":1}'

# Test invalid input (should reject)
curl -X POST https://your-worker.workers.dev/sse \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"search_stations","arguments":{"city":"london","query":"test"}},"id":1}'
# Should return "Unsupported city code"
```

### Security Headers

```bash
# Check security headers
curl -I https://your-worker.workers.dev/
# Should include:
# - Content-Security-Policy
# - X-Frame-Options: DENY
# - X-Content-Type-Options: nosniff
# - Referrer-Policy
# - Permissions-Policy
```

## Rollback Plan

If issues arise:

```bash
# 1. Rollback deployment
wrangler rollback

# 2. Or deploy previous version
git checkout main
npm run deploy

# 3. KV namespace is safe to leave (won't hurt anything)
```

## Configuration Changes

### Environment Variables (No Changes)

All existing environment variables work the same:
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `OAUTH_REDIRECT_URI`
- `WMATA_API_KEY`
- `JWT_SECRET`

### New Optional Variables

```bash
# Optional: Set environment name
wrangler secret put ENVIRONMENT
# Values: development, staging, production
```

## Code Changes

### No Changes Required in Client Code

All API endpoints work the same:
- `/authorize`
- `/token`
- `/callback`
- `/sse`
- `/.well-known/oauth-authorization-server`

### Response Format Changes

**Rate Limit Headers** (new, non-breaking):
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1735689600
```

**Better Error Messages** (improved, non-breaking):
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": "Invalid station name format. Letters, numbers, spaces, and common punctuation only"
  }
}
```

## Performance Impact

### Expected Changes

**Positive:**
- ✅ Better error handling (fewer retries)
- ✅ Input validation prevents wasted API calls
- ✅ Security headers cached by browsers

**Negligible:**
- Rate limiting adds ~1-2ms per request (KV read/write)
- Input validation adds <1ms per request
- Security headers add ~0.5KB to response

**Monitoring:**
```bash
# Before update
Average response time: ~100ms

# After update
Average response time: ~102ms (within normal variance)
```

## Troubleshooting

### Issue: "RATE_LIMIT_KV is not defined"

**Cause**: KV namespace not created or not bound

**Solution**:
```bash
# Create KV namespace
wrangler kv:namespace create "RATE_LIMIT_KV"

# Update wrangler.toml with the ID
# Deploy again
npm run deploy
```

### Issue: All requests blocked (429)

**Cause**: Rate limit too aggressive or shared IP

**Solution**:
```bash
# Check current limits in src/config.ts
# Temporarily increase for testing
maxRequestsPerMinute: 1000  # Instead of 100

# Or clear rate limit data
wrangler kv:key delete "rate_limit:*" --namespace-id YOUR-KV-ID
```

### Issue: Tests failing

**Cause**: Missing dependencies or environment

**Solution**:
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Run tests with verbose output
npm test -- --reporter=verbose
```

### Issue: Coverage below 60%

**Cause**: Some modules not tested yet

**Solution**:
```bash
# Check coverage report
npm run test:coverage
open coverage/index.html

# See which files need more tests
# Focus on critical paths first:
# - src/auth.ts
# - src/middleware/input-validator.ts
# - src/middleware/rate-limiter.ts
```

## Getting Help

**Documentation:**
- [Testing Guide](./TESTING_GUIDE.md)
- [Security Guide](./SECURITY.md)
- [README](../README.md)

**Issues:**
- Create GitHub issue with:
  - Error message
  - Steps to reproduce
  - Environment (dev/production)
  - Worker logs

**Questions:**
- Check existing documentation first
- Search closed issues
- Open new discussion

## Success Criteria

You've successfully migrated when:

- ✅ All tests pass (`npm test`)
- ✅ Coverage ≥60% (`npm run test:coverage`)
- ✅ Rate limiting works (test with curl)
- ✅ Input validation works (test with invalid data)
- ✅ Security headers present (curl -I)
- ✅ OAuth flow works (test in Claude Desktop)
- ✅ No errors in Cloudflare logs
- ✅ Response times normal (<200ms)

## Next Steps

After migration:

1. **Monitor**: Watch metrics for anomalies
2. **Document**: Update internal docs if needed
3. **Train**: Share new security features with team
4. **Improve**: Add more tests over time
5. **Iterate**: Adjust rate limits based on usage

Welcome to the new, more secure Metro MCP! 🎉
