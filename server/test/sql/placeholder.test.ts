import { describe, expect, it } from 'vitest';

describe('sql project setup', () => {
  it('runs under the America/Los_Angeles test timezone', () => {
    expect(process.env.TZ).toBe('America/Los_Angeles');
  });
});
