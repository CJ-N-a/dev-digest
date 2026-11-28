import { describe, expect, it } from 'vitest';
import { subtotalCents } from '../src/pricing.js';

describe('subtotalCents', () => {
  it('sums unit price × quantity', () => {
    expect(
      subtotalCents([
        { sku: 'mug', unitPriceCents: 1_200, quantity: 2 },
        { sku: 'tea', unitPriceCents: 800, quantity: 1 },
      ]),
    ).toBe(3_200);
  });
});
