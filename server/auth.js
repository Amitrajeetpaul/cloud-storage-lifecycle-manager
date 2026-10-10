import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { logger } from './logger.js';

const TOKEN_TTL = '12h';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

// A JWT_SECRET must stay the same across restarts for existing tokens to
// keep working, so production deployments should always set it explicitly.
// For local dev we generate one at boot and warn — restarting the server
// invalidates any tokens issued under the previous random secret, which is
// an acceptable dev-only inconvenience.
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  JWT_SECRET = crypto.randomBytes(32).toString('hex');
  logger.warn(
    'JWT_SECRET not set — generated a random one for this run. ' +
    'Set JWT_SECRET in your .env for production so sessions survive restarts.'
  );
}
if (!process.env.ADMIN_PASSWORD) {
  logger.warn('ADMIN_PASSWORD not set — using the insecure default "admin". Set it in your .env.');
}

const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);

export function verifyCredentials(username, password) {
  if (username !== ADMIN_USERNAME) return false;
  return bcrypt.compareSync(password, passwordHash);
}

export function createToken(username) {
  return jwt.sign({ sub: username }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}
