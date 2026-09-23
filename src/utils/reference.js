import crypto from 'node:crypto';

export function makeReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const code = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `NIN-${date}-${code}`;
}
