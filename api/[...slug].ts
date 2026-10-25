import { createServer } from 'http';
import { app } from '../server/src/server';

// Vercel will invoke this handler for any request that starts with /api/
export default async function handler(req: any, res: any) {
  const server = createServer(app);
  server.emit('request', req, res);
}
