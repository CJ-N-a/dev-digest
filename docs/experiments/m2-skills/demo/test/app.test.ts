import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

describe('GET /orders/:id', () => {
  it('returns the order with its total', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/orders/1' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: 1, customerId: 'cus_ada', status: 'open', totalCents: 3_200 });
  });
});
