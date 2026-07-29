import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import AdminUser from '../models/AdminUser.js';

const SHOP_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const jwtSecret = () => process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;

const unauthorized = (res, message = 'Authentication required') =>
  res.status(401).json({ success: false, message });

export const signAdminToken = (admin) => {
  const secret = jwtSecret();
  if (!secret) throw new Error('ADMIN_JWT_SECRET is not configured');
  return jwt.sign(
    { sub: admin._id.toString(), shopId: admin.shopId, role: admin.role, type: 'admin' },
    secret,
    {
      expiresIn: process.env.ADMIN_JWT_EXPIRES_IN || '8h',
      issuer: 'cmes-admin',
      audience: 'cmes-admin',
    }
  );
};

/**
 * Short-lived token for a read-only display (OBS). It is deliberately not an
 * admin token, so a leaked browser-source URL cannot administer a shop.
 */
export const signDisplayToken = (shopId) => {
  const secret = jwtSecret();
  if (!secret) throw new Error('ADMIN_JWT_SECRET is not configured');
  return jwt.sign(
    { shopId, type: 'display' },
    secret,
    {
      expiresIn: process.env.OBS_JWT_EXPIRES_IN || '24h',
      issuer: 'cmes-admin',
      audience: 'cmes-admin',
    }
  );
};

export const verifyAdminToken = (token) => {
  const secret = jwtSecret();
  if (!secret) throw new Error('ADMIN_JWT_SECRET is not configured');
  return jwt.verify(token, secret, { issuer: 'cmes-admin', audience: 'cmes-admin' });
};

export const authenticateSocketToken = async (token) => {
  const claims = verifyAdminToken(token);
  if (!claims.shopId || !SHOP_ID_PATTERN.test(claims.shopId)) {
    throw new Error('Invalid socket token');
  }

  if (claims.type === 'display') return { kind: 'display', shopId: claims.shopId };
  if (claims.type !== 'admin' || !claims.sub) throw new Error('Invalid socket token');

  const { admin } = await authenticateAdminToken(token);
  return { kind: 'admin', shopId: admin.shopId, adminId: admin._id.toString(), role: admin.role };
};

export const authenticateAdminToken = async (token) => {
  const claims = verifyAdminToken(token);
  if (claims.type !== 'admin' || !claims.sub || !claims.shopId) {
    throw new Error('Invalid admin token');
  }
  const admin = await AdminUser.findById(claims.sub).select('_id shopId role isActive').lean();
  if (!admin || !admin.isActive || admin.shopId !== claims.shopId) {
    throw new Error('Session is no longer valid');
  }
  return { claims, admin };
};

const bearerToken = (req) => {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
};

/**
 * For read-only, public shop data only. Never use this as authorization.
 */
export const requireShopId = (req, res, next) => {
  const shopId = req.headers['x-shop-id'] || req.query.shopId;
  if (!shopId || typeof shopId !== 'string' || !SHOP_ID_PATTERN.test(shopId)) {
    return res.status(400).json({ success: false, message: 'A valid shopId is required' });
  }
  req.shopId = shopId;
  return next();
};

/**
 * Private Admin API: identity and tenant are derived from a signed JWT only.
 */
export const requireAdminAuth = async (req, res, next) => {
  try {
    const token = bearerToken(req);
    if (!token) return unauthorized(res);
    const { admin } = await authenticateAdminToken(token);
    req.adminId = admin._id.toString();
    req.shopId = admin.shopId;
    req.auth = { adminId: req.adminId, shopId: admin.shopId, role: admin.role };
    return next();
  } catch {
    return unauthorized(res, 'Invalid or expired session');
  }
};

/**
 * Calls received from CMES-USER backend. The shared secret must never reach a browser.
 */
export const requireUserServiceAuth = (req, res, next) => {
  const expected = process.env.USER_SERVICE_TOKEN;
  const actual = req.headers['x-cmes-service-token'];
  if (!expected || !actual) {
    return res.status(503).json({ success: false, message: 'User service authentication is not configured' });
  }
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(String(actual));
  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    return unauthorized(res, 'Invalid user service credentials');
  }
  return requireShopId(req, res, next);
};

/** Read-only data needed by either the Admin UI or CMES-USER server. */
export const requireAdminOrUserServiceAuth = (req, res, next) => {
  if (bearerToken(req)) return requireAdminAuth(req, res, next);
  return requireUserServiceAuth(req, res, next);
};
