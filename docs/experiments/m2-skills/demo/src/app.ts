import Fastify, { type FastifyInstance } from 'fastify';
import { findOrder, orderTotalCents } from './orders.js';

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.get<{ Params: { id: number } }>(
    '/orders/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'integer', minimum: 1 } },
        },
        response: {
          200: {
            type: 'object',
            required: ['id', 'customerId', 'status', 'totalCents'],
            properties: {
              id: { type: 'integer' },
              customerId: { type: 'string' },
              status: { type: 'string', enum: ['open', 'paid', 'shipped'] },
              totalCents: { type: 'integer' },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const order = findOrder(req.params.id);
      if (!order) {
        return reply
          .code(404)
          .send({ error: { code: 'order_not_found', message: `Order ${req.params.id} not found` } });
      }
      return {
        id: order.id,
        customerId: order.customerId,
        status: order.status,
        totalCents: orderTotalCents(order),
      };
    },
  );

  return app;
}
