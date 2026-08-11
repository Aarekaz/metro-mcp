import { describe, expect, it, vi } from 'vitest';
import { SecurityState } from '../../src/security-state';
import type { Env } from '../../src/types';

function createState(): DurableObjectState {
  const values = new Map<string, unknown>();
  let transactionTail = Promise.resolve();

  const storage = {
    async get<T>(key: string): Promise<T | undefined> {
      return values.get(key) as T | undefined;
    },
    async put(key: string, value: unknown): Promise<void> {
      values.set(key, value);
    },
    async delete(key: string): Promise<boolean> {
      return values.delete(key);
    },
    async deleteAll(): Promise<void> {
      values.clear();
    },
    setAlarm: vi.fn().mockResolvedValue(undefined),
    transaction<T>(callback: (transaction: typeof storage) => Promise<T>): Promise<T> {
      const result = transactionTail.then(() => callback(storage));
      transactionTail = result.then(() => undefined, () => undefined);
      return result;
    }
  };

  return { storage } as unknown as DurableObjectState;
}

describe('SecurityState', () => {
  it('validates and consumes an OAuth code exactly once', async () => {
    const object = new SecurityState(createState(), {} as Env);
    const record = {
      clientId: 'client-a',
      codeChallenge: 'challenge-a',
      expiresAt: Date.now() + 60_000
    };
    await object.fetch(new Request('https://internal/oauth-code', {
      method: 'PUT',
      body: JSON.stringify(record)
    }));

    const consume = () => object.fetch(new Request('https://internal/oauth-code/consume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: 'client-a', codeChallenge: 'challenge-a' })
    }));
    const responses = await Promise.all([consume(), consume()]);

    expect(responses.map(response => response.status).sort()).toEqual([200, 404]);
  });

  it('keeps an OAuth code available after mismatched credentials', async () => {
    const object = new SecurityState(createState(), {} as Env);
    await object.fetch(new Request('https://internal/oauth-code', {
      method: 'PUT',
      body: JSON.stringify({
        clientId: 'client-a',
        codeChallenge: 'challenge-a',
        expiresAt: Date.now() + 60_000
      })
    }));

    const rejected = await object.fetch(new Request('https://internal/oauth-code/consume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: 'client-a', codeChallenge: 'wrong' })
    }));
    const accepted = await object.fetch(new Request('https://internal/oauth-code/consume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: 'client-a', codeChallenge: 'challenge-a' })
    }));

    expect(rejected.status).toBe(403);
    expect(accepted.status).toBe(200);
  });

  it('serializes concurrent rate-limit updates', async () => {
    const object = new SecurityState(createState(), {} as Env);
    const check = () => object.fetch(new Request('https://internal/rate-limit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ now: Date.now(), maxRequests: 5, windowSeconds: 60 })
    }));
    const responses = await Promise.all(Array.from({ length: 8 }, check));
    const results = await Promise.all(responses.map(response => response.json() as Promise<{ allowed: boolean }>));

    expect(results.filter(result => result.allowed)).toHaveLength(5);
    expect(results.filter(result => !result.allowed)).toHaveLength(3);
  });
});
