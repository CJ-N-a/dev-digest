import { subtotalCents, type LineItem } from './pricing.js';

export type CustomerTier = 'standard' | 'gold';
export type OrderStatus = 'open' | 'paid' | 'shipped';

export interface Order {
  id: number;
  customerId: string;
  customerTier: CustomerTier;
  status: OrderStatus;
  items: LineItem[];
}

const orders = new Map<number, Order>([
  [
    1,
    {
      id: 1,
      customerId: 'cus_ada',
      customerTier: 'standard',
      status: 'open',
      items: [
        { sku: 'mug', unitPriceCents: 1_200, quantity: 2 },
        { sku: 'tea', unitPriceCents: 800, quantity: 1 },
      ],
    },
  ],
  [
    2,
    {
      id: 2,
      customerId: 'cus_grace',
      customerTier: 'gold',
      status: 'paid',
      items: [{ sku: 'kettle', unitPriceCents: 4_500, quantity: 1 }],
    },
  ],
]);

export function findOrder(id: number): Order | undefined {
  return orders.get(id);
}

export function orderTotalCents(order: Order): number {
  return subtotalCents(order.items);
}
