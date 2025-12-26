# Quick Reference Guide

Fast access to common commands and workflows.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run tests
npm test

# Start development
npm run dev

# Deploy
npm run deploy
```

## 🧪 Testing Commands

```bash
# Run all tests
npm test

# Watch mode (auto-rerun on changes)
npm run test:watch

# Generate coverage report
npm run test:coverage

# Interactive UI
npm run test:ui

# Run specific test file
npm test -- rate-limiter.test.ts

# Run tests matching pattern
npm test -- --grep="validation"

# Type checking
npm run type-check
```

## 🔧 Development Workflow

### 1. Make Changes
```bash
# Create feature branch
git checkout -b feature/my-feature

# Make your changes
# ...

# Run tests
npm test

# Check types
npm run type-check
```

### 2. Before Commit
```bash
# Run all checks
npm test && npm run type-check

# Commit with descriptive message
git commit -m "feat: add new feature

WHY: Explain the rationale
- Key changes
- Benefits"
```

### 3. Deploy
```bash
# Deploy to preview
npm run dev  # Test locally first

# Deploy to production
npm run deploy

# Verify deployment
curl -I https://your-worker.workers.dev/
```

## 🐛 Troubleshooting

### Tests Failing?
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Run with verbose output
npm test -- --reporter=verbose

# Check specific test
npm test -- --grep="failing test name"
```

### Rate Limiting Not Working?
```bash
# Check KV namespace exists
wrangler kv:namespace list

# Verify wrangler.toml has correct IDs
cat wrangler.toml | grep -A 3 RATE_LIMIT_KV

# Test rate limiting locally
for i in {1..101}; do curl http://localhost:8787/; done
```

### TypeScript Errors?
```bash
# Check configuration
cat tsconfig.json

# Run type checker
npm run type-check

# Restart VS Code TypeScript server
# Cmd+Shift+P -> "TypeScript: Restart TS Server"
```

## 🔒 Security Checklist

Before deploying:

- [ ] All tests pass
- [ ] No secrets in code
- [ ] Rate limiting enabled
- [ ] Input validation on all user inputs
- [ ] Security headers configured
- [ ] Environment variables set
- [ ] KV namespaces created
- [ ] No console.logs with sensitive data

## 📝 Common Tasks

### Add New Test
```typescript
// tests/unit/my-module.test.ts
import { describe, it, expect } from 'vitest';
import { myFunction } from '../../src/my-module';

describe('MyModule', () => {
  it('should do something', () => {
    const result = myFunction();
    expect(result).toBe(expected);
  });
});
```

### Add New Validation Rule
```typescript
// src/middleware/input-validator.ts
export function validateMyInput(input: unknown): string {
  if (typeof input !== 'string') {
    throw new ValidationError('Must be string', 'myInput', input, 'type');
  }
  
  const sanitized = sanitizeString(input, 100);
  
  if (!/^[a-zA-Z0-9]+$/.test(sanitized)) {
    throw new ValidationError('Invalid format', 'myInput', input, 'pattern');
  }
  
  return sanitized;
}
```

### Add Rate Limiting to Endpoint
```typescript
// src/router.ts
import { applyRateLimit, createRateLimitResponse } from './middleware/rate-limiter';

async handleRequest(request: Request, env: Env): Promise<Response> {
  // Check rate limit
  const rateLimitResult = await applyRateLimit(request, env, 'mcp');
  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult);
  }
  
  // Process request
  // ...
}
```

### Add Security Headers
```typescript
// src/some-handler.ts
import { createSecureJsonResponse } from './middleware/security-headers';

return createSecureJsonResponse(
  { status: 'ok' },
  200,
  { 'X-Custom-Header': 'value' }
);
```

## 🔍 Debugging

### Debug Single Test
```typescript
// In test file
it.only('debug this test', () => {
  console.log('Debug info:', value);
  expect(value).toBe(expected);
});
```

### Debug in VS Code
1. Set breakpoint in test file
2. Open "JavaScript Debug Terminal"
3. Run: `npm test`

### Check Logs in Production
```bash
# Stream logs
wrangler tail

# Or check Cloudflare dashboard
# Workers & Pages -> Your Worker -> Logs
```

## 📊 Performance Monitoring

### Check Response Times
```bash
# Time a request
time curl https://your-worker.workers.dev/

# Check headers
curl -i https://your-worker.workers.dev/
```

### Monitor Rate Limiting
```bash
# Check rate limit headers
curl -I https://your-worker.workers.dev/ | grep RateLimit

# Expected output:
# X-RateLimit-Limit: 100
# X-RateLimit-Remaining: 99
# X-RateLimit-Reset: 1735689600
```

## 🔑 Environment Variables

### Required Variables
```bash
# Set secrets (never commit these!)
wrangler secret put WMATA_API_KEY
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put JWT_SECRET

# List secrets
wrangler secret list
```

### Public Variables
```toml
# In wrangler.toml (safe to commit)
[vars]
GITHUB_CLIENT_ID = "your-client-id"
OAUTH_REDIRECT_URI = "https://your-worker.workers.dev/callback"
```

## 📚 Documentation

- [Testing Guide](./TESTING_GUIDE.md) - Complete testing documentation
- [Security Guide](./SECURITY.md) - Security architecture and best practices
- [Migration Guide](./MIGRATION.md) - How to upgrade to this version
- [Main README](../README.md) - Project overview and setup

## 🆘 Getting Help

1. **Check Documentation**: Most questions answered in guides above
2. **Search Issues**: Check if already reported/solved
3. **Create Issue**: Include error message, steps to reproduce, environment
4. **Ask in Discussions**: For questions and general help

## 🎯 Key Files

```
.
├── src/
│   ├── middleware/
│   │   ├── rate-limiter.ts       # Rate limiting
│   │   ├── input-validator.ts    # Input validation
│   │   └── security-headers.ts   # Security headers
│   ├── config.ts                 # Configuration
│   ├── auth.ts                   # Authentication
│   ├── router.ts                 # Request routing
│   └── types.ts                  # Type definitions
├── tests/
│   ├── setup.ts                  # Test utilities
│   └── unit/                     # Unit tests
├── docs/
│   ├── TESTING_GUIDE.md
│   ├── SECURITY.md
│   ├── MIGRATION.md
│   └── QUICK_REFERENCE.md        # This file
├── package.json                  # Dependencies and scripts
├── vitest.config.ts              # Test configuration
├── tsconfig.json                 # TypeScript configuration
└── wrangler.toml                 # Cloudflare Workers configuration
```

## 💡 Tips

- **Write tests first**: Makes development faster and catches bugs early
- **Run tests in watch mode**: Instant feedback while coding
- **Use TypeScript**: Catches errors before runtime
- **Check coverage**: Aim for 60%+ overall, 100% on critical paths
- **Document WHY**: Not just what, but why you made decisions
- **Security first**: Validate inputs, rate limit requests, use proper headers

## 🎓 Learning Resources

- [Vitest Docs](https://vitest.dev/) - Modern test framework
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/) - Platform documentation
- [OWASP](https://owasp.org/) - Security best practices
- [TypeScript Handbook](https://www.typescriptlang.org/docs/) - TypeScript guide
