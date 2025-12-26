# Testing Guide

This guide explains how to test the Metro MCP codebase effectively.

## Table of Contents

- [Overview](#overview)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Test Structure](#test-structure)
- [Coverage Requirements](#coverage-requirements)
- [Debugging Tests](#debugging-tests)
- [Best Practices](#best-practices)

## Overview

### Testing Stack

- **Test Runner**: [Vitest](https://vitest.dev/) - Modern, fast, TypeScript-native
- **Coverage**: V8 coverage provider (accurate source-level coverage)
- **Mocking**: Vitest's built-in mocking for Cloudflare Workers APIs

### Why Vitest?

1. **Fast**: Parallel test execution, smart watch mode
2. **Modern**: Native ESM and TypeScript support
3. **Great DX**: Instant feedback, helpful error messages
4. **Workers-Compatible**: No Node.js dependencies that conflict with Workers runtime

## Running Tests

### All Tests

```bash
# Run all tests once
npm test

# Or with bun
bun test
```

### Watch Mode

```bash
# Run tests in watch mode (re-runs on file changes)
npm run test:watch
```

### Coverage Report

```bash
# Generate coverage report
npm run test:coverage

# Opens HTML report in browser
open coverage/index.html
```

### UI Mode

```bash
# Run tests with interactive UI
npm run test:ui
```

### Specific Test Files

```bash
# Run tests in a specific file
npm test -- rate-limiter.test.ts

# Run tests matching a pattern
npm test -- --grep="validation"
```

## Writing Tests

### Test File Location

- **Unit tests**: `tests/unit/*.test.ts`
- **Integration tests**: `tests/integration/*.test.ts`
- **E2E tests**: `tests/e2e/*.test.ts`

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { functionToTest } from '../../src/module';
import { createMockEnv } from '../setup';

describe('ModuleName', () => {
  let env: ReturnType<typeof createMockEnv>;

  beforeEach(() => {
    env = createMockEnv();
  });

  describe('functionToTest', () => {
    it('should do what it is supposed to do', () => {
      const result = functionToTest(env);
      expect(result).toBe(expectedValue);
    });

    it('should handle edge cases', () => {
      expect(() => functionToTest(null)).toThrow();
    });
  });
});
```

### Using Test Utilities

The `tests/setup.ts` file provides helpful utilities:

```typescript
import {
  createMockEnv,        // Mock Cloudflare Workers environment
  createMockKV,         // Mock KV namespace
  createMockRequest,    // Mock Request object
  createMockResponse,   // Mock Response object
  createMockFetch,      // Mock fetch function
} from '../setup';

// Create a test environment
const env = createMockEnv({
  WMATA_API_KEY: 'custom-key',  // Override defaults
});

// Create a test request
const request = createMockRequest(
  'POST',
  'http://localhost/api',
  { key: 'value' },  // Body
  { 'Authorization': 'Bearer token' }  // Headers
);

// Mock external API
global.fetch = createMockFetch({ data: 'test' }, 200);
```

### Testing Async Functions

```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBeTruthy();
});
```

### Testing Errors

```typescript
it('should throw on invalid input', () => {
  expect(() => functionThatThrows()).toThrow('Expected error message');
});

it('should reject on async error', async () => {
  await expect(asyncFunctionThatRejects()).rejects.toThrow();
});
```

### Mocking

```typescript
import { vi } from 'vitest';

// Mock a function
const mockFn = vi.fn().mockReturnValue('result');

// Mock with different values
const mockFn = vi.fn()
  .mockReturnValueOnce('first')
  .mockReturnValueOnce('second');

// Mock implementation
const mockFn = vi.fn((x) => x * 2);

// Spy on object method
const spy = vi.spyOn(object, 'method');
expect(spy).toHaveBeenCalledWith(expectedArg);
```

## Test Structure

### Test Organization

Organize tests with `describe` blocks:

```typescript
describe('ModuleName', () => {
  describe('method1', () => {
    it('should handle normal case', () => {});
    it('should handle edge case', () => {});
    it('should throw on error', () => {});
  });

  describe('method2', () => {
    // ...
  });
});
```

### Setup and Teardown

```typescript
import { describe, it, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';

describe('Tests', () => {
  beforeAll(() => {
    // Runs once before all tests in this describe block
  });

  afterAll(() => {
    // Runs once after all tests in this describe block
  });

  beforeEach(() => {
    // Runs before each test
  });

  afterEach(() => {
    // Runs after each test
  });
});
```

### Test Naming

Follow the "should" convention:

```typescript
it('should return user data when token is valid', () => {});
it('should throw AuthError when token is expired', () => {});
it('should sanitize input to prevent XSS', () => {});
```

## Coverage Requirements

### Current Targets

- **Lines**: 60%
- **Functions**: 60%
- **Branches**: 50%
- **Statements**: 60%

### Critical Paths (100% Coverage Required)

- Authentication (`src/auth.ts`)
- Input validation (`src/middleware/input-validator.ts`)
- Rate limiting (`src/middleware/rate-limiter.ts`)
- Security headers (`src/middleware/security-headers.ts`)

### Excluded from Coverage

- Type definition files (`*.types.ts`)
- Test files (`*.test.ts`, `*.spec.ts`)
- Entry point (`src/index.ts`) - tested via integration tests

### Viewing Coverage

```bash
# Generate and view HTML report
npm run test:coverage
open coverage/index.html

# View text summary
npm run test:coverage -- --reporter=text
```

## Debugging Tests

### Console Logging

```typescript
it('should do something', () => {
  console.log('Debug info:', value);
  expect(value).toBe(expected);
});
```

### Debugging in VSCode

1. Set breakpoint in test file
2. Run "Debug: JavaScript Debug Terminal"
3. Run `npm test` in the debug terminal

### Isolated Test

Use `.only` to run a single test:

```typescript
it.only('should debug this test', () => {
  // Only this test will run
});
```

### Skip Tests

Use `.skip` to temporarily skip tests:

```typescript
it.skip('should be fixed later', () => {
  // This test won't run
});
```

### Verbose Output

```bash
# Show all test names as they run
npm test -- --reporter=verbose
```

## Best Practices

### 1. Test Behavior, Not Implementation

**Good:**
```typescript
it('should return sanitized input', () => {
  const result = sanitizeString('<script>alert(1)</script>');
  expect(result).not.toContain('<script>');
});
```

**Bad:**
```typescript
it('should call replace 5 times', () => {
  const spy = vi.spyOn(String.prototype, 'replace');
  sanitizeString('test');
  expect(spy).toHaveBeenCalledTimes(5);
});
```

### 2. Test Edge Cases

```typescript
describe('validateStationName', () => {
  it('should accept valid names', () => {});
  it('should reject empty names', () => {});
  it('should reject too-long names', () => {});
  it('should reject invalid characters', () => {});
  it('should handle Unicode correctly', () => {});
});
```

### 3. Use Descriptive Test Names

```typescript
// Good
it('should return 401 when JWT token is expired');

// Bad
it('test auth');
```

### 4. Keep Tests Independent

Each test should be able to run in isolation:

```typescript
// Good
beforeEach(() => {
  env = createMockEnv();  // Fresh environment for each test
});

// Bad
let sharedState = {};  // Tests modify shared state
```

### 5. Don't Test External APIs

Mock external dependencies:

```typescript
// Good
global.fetch = vi.fn().mockResolvedValue(mockResponse);
const result = await fetchUserData();

// Bad
const result = await fetch('https://api.github.com/user');  // Real API call
```

### 6. Test Security Critical Code Thoroughly

```typescript
describe('validateSearchQuery', () => {
  it('should accept valid queries', () => {});
  it('should reject XSS attempts', () => {});
  it('should reject SQL injection attempts', () => {});
  it('should reject path traversal attempts', () => {});
  it('should enforce length limits', () => {});
});
```

### 7. Use Test Fixtures

```typescript
// In tests/setup.ts
export const mockUser = {
  id: '123',
  login: 'testuser',
  name: 'Test User',
};

// In test file
import { mockUser } from '../setup';

it('should process user data', () => {
  const result = processUser(mockUser);
  expect(result).toBeTruthy();
});
```

### 8. Test Happy Path and Sad Path

```typescript
describe('authenticateUser', () => {
  it('should return user when credentials are valid', () => {});
  it('should throw when credentials are invalid', () => {});
  it('should throw when user not found', () => {});
  it('should throw when account is locked', () => {});
});
```

## Common Issues

### Issue: "Cannot find module"

**Solution**: Check import paths are correct:
```typescript
// Correct
import { function } from '../../src/module';

// Wrong
import { function } from 'src/module';
```

### Issue: "KV is not defined"

**Solution**: Use `createMockKV()` from test setup:
```typescript
const env = createMockEnv();  // Already includes mock KV
```

### Issue: Tests timeout

**Solution**: Increase timeout or check for infinite loops:
```typescript
it('should complete eventually', async () => {
  // ...
}, 20000);  // 20 second timeout
```

### Issue: Flaky tests

**Solution**: 
1. Use `vi.useFakeTimers()` for time-dependent code
2. Await all promises
3. Reset mocks between tests
4. Don't rely on execution order

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://testingjavascript.com/)
- [Cloudflare Workers Testing](https://developers.cloudflare.com/workers/testing/)
