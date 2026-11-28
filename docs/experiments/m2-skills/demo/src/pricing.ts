export interface LineItem {
  sku: string;
  unitPriceCents: number;
  quantity: number;
}

/** Sum of line items in cents. An empty cart costs nothing. */
export function subtotalCents(items: LineItem[]): number {
  if (items.length === 0) return 0;
  return items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
}
