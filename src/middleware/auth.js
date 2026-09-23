import { env } from '../config/env.js';

export function adminAuth(req, res, next) {
  const headerKey = req.get('x-admin-api-key') || '';
  const authHeader = req.get('authorization') || '';
  const bearerKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const suppliedKey = headerKey || bearerKey;

  if (!env.adminApiKey || suppliedKey !== env.adminApiKey) {
    return res.status(401).json({ success: false, message: 'Unauthorized.' });
  }

  next();
}
