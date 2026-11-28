# Worked examples

## Renamed path parameter (breaking)
```diff
- /orders/{id}:
+ /orders/{orderId}:
```
Generated clients send `id`; the server now requires `orderId` → 400.

## Response field moved (breaking)
```diff
  Order:
    properties:
-     total: { type: integer }
+     amount:
+       type: object
+       properties: { total: { type: integer }, currency: { type: string } }
```
A client reading `order.total` gets `undefined`.

## New optional query parameter (compatible)
```diff
+   - name: status
+     in: query
+     required: false
```
Old clients keep working.
