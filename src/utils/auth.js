import crypto from 'node:crypto';
import UserSession from '../models/UserSession.js';

export const AUTH_COOKIE_NAME = 'nin_session';

const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_SALT_BYTES = 16;
const SESSION_TOKEN_BYTES = 32;

function scryptAsync(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, PASSWORD_KEY_LENGTH, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(PASSWORD_SALT_BYTES).toString('hex');
  const derivedKey = await scryptAsync(password, salt);
  return `${salt}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password, storedHash) {
  const [salt, storedKeyHex] = String(storedHash || '').split(':');

  if (!salt || !storedKeyHex) {
    return false;
  }

  const derivedKey = await scryptAsync(password, salt);
  const storedKey = Buffer.from(storedKeyHex, 'hex');

  if (storedKey.length !== derivedKey.length) {
    return false;
  }

  return crypto.timingSafeEqual(storedKey, derivedKey);
}

export function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createSessionToken() {
  return crypto.randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
}

function parseCookies(header = '') {
  const cookies = {};

  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;

    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    if (name) {
      try {
        cookies[name] = decodeURIComponent(value);
      } catch {
        cookies[name] = value;
      }
    }
  }

  return cookies;
}

export function getSessionTokenFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  return cookies[AUTH_COOKIE_NAME] || '';
}

function appendCookie(res, value, maxAgeSeconds) {
  const isProduction =
    process.env.NODE_ENV === 'production';

  const parts = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    `SameSite=${isProduction ? 'None' : 'Lax'}`,
  ];

  if (maxAgeSeconds !== null) {
    parts.push(
      `Max-Age=${Math.max(
        0,
        Math.floor(maxAgeSeconds)
      )}`
    );
  }

  if (isProduction) {
    parts.push('Secure');
  }

  res.append(
    'Set-Cookie',
    parts.join('; ')
  );
}

export function setSessionCookie(res, token, remember = false) {
  const maxAgeSeconds = remember
    ? 30 * 24 * 60 * 60
    : 8 * 60 * 60;

  appendCookie(res, token, maxAgeSeconds);
}

export function clearSessionCookie(res) {
  appendCookie(res, '', 0);
}

export async function createUserSession(userId, remember = false) {
  const token = createSessionToken();
  const maxAgeMs = remember
    ? 30 * 24 * 60 * 60 * 1000
    : 8 * 60 * 60 * 1000;

  await UserSession.create({
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(Date.now() + maxAgeMs),
  });

  return token;
}

export async function revokeCurrentSession(req) {
  const token = getSessionTokenFromRequest(req);

  if (!token) {
    return;
  }

  await UserSession.deleteOne({
    tokenHash: hashSessionToken(token),
  });
}
