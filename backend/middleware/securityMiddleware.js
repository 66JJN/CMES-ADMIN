/**
 * Security Middleware — CMES-ADMIN
 * ป้องกัน NoSQL Injection, Input Validation, Sanitization
 */

/**
 * ลบ MongoDB operators ($, .) จาก object เพื่อป้องกัน NoSQL Injection
 * ถ้าเจอ key ที่อันตราย จะ log warning ไว้
 */
export function sanitizeObject(obj, reqPath = '') {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => sanitizeObject(item, reqPath));

  const sanitized = {};
  let hasDangerousKeys = false;

  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      hasDangerousKeys = true;
      continue; // ลบ key อันตรายออก
    }
    sanitized[key] = sanitizeObject(obj[key], reqPath);
  }

  if (hasDangerousKeys) {
    console.warn(`[Security] ⚠️ Potential NoSQL injection attempt: ${reqPath}`);
  }

  return sanitized;
}

/**
 * Middleware: Sanitize req.body, req.query, req.params
 * ป้องกัน NoSQL Injection โดยอัตโนมัติ
 */
export const mongoSanitize = (req, res, next) => {
  if (req.body) req.body = sanitizeObject(req.body, req.path);
  if (req.query) req.query = sanitizeObject(req.query, req.path);
  if (req.params) req.params = sanitizeObject(req.params, req.path);
  next();
};

/**
 * Validate shopId — ต้องเป็น string ยาวไม่เกิน 50 ตัวอักษร, ไม่มีอักขระพิเศษ
 */
export function validateShopId(shopId) {
  if (!shopId || typeof shopId !== 'string') return false;
  if (shopId.length > 50) return false;
  // อนุญาตเฉพาะ a-z, A-Z, 0-9, -, _
  return /^[a-zA-Z0-9_-]+$/.test(shopId);
}

/**
 * Validate string field — ตัดช่องว่าง + จำกัดความยาว
 */
export function validateStringField(value, maxLength = 500) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') return String(value).substring(0, maxLength);
  return value.trim().substring(0, maxLength);
}

/**
 * Validate ตัวเลข — ต้องเป็น number ที่ valid, ไม่ติดลบ, ไม่เกิน max
 */
export function validateNumber(value, min = 0, max = 999999) {
  const num = Number(value);
  if (isNaN(num)) return null;
  if (num < min || num > max) return null;
  return num;
}
