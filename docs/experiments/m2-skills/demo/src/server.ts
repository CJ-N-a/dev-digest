import { buildApp } from './app.js';

const port = Number(process.env.PORT ?? 3005);
await buildApp().listen({ port, host: '127.0.0.1' });
console.log(`orders demo on http://127.0.0.1:${port}`);
