import { Request, Response, NextFunction } from 'express';
import { verifyAccess, AccessPayload } from '../auth';
import { db } from '../db';

export interface AuthedRequest extends Request {
  user?: AccessPayload & { id: number };
  subscription?: any;
}

/**
 * Endpoints that stay reachable while the account still has to replace its
 * initial password.
 */
const ALLOWED_WHILE_PASSWORD_PENDING = [
  '/api/auth/change-password',
  '/api/auth/logout',
  '/api/auth/refresh',
  '/api/user/account/status',
];

function isPasswordChangePending(path: string): boolean {
  return ALLOWED_WHILE_PASSWORD_PENDING.some(allowed => path === allowed || path.startsWith(`${allowed}/`));
}

export function authMiddleware(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, message: 'Missing access token' });

  try {
    const decoded = verifyAccess(token);
    // pastikan user masih aktif
    const user = db.prepare(`SELECT id, role, email, status, must_change_pwd FROM users WHERE id = ?`).get(decoded.sub) as
      | { id: number; role: string; email: string; status: string; must_change_pwd: number }
      | undefined;
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        error_code: 'ACCOUNT_SUSPENDED',
        message: 'Akun Anda tidak aktif. Hubungi admin.',
      });
    }
    if (user.must_change_pwd) {
      const path = (req.originalUrl || req.url || '').split('?')[0];
      if (!isPasswordChangePending(path)) {
        return res.status(403).json({
          success: false,
          error_code: 'PASSWORD_CHANGE_REQUIRED',
          message: 'Kata sandi awal harus diganti sebelum memakai API lain.',
        });
      }
    }
    req.user = { ...decoded, id: user.id, role: user.role, email: user.email };
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
  if (!['admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Admin only' });
  }
  next();
}

export function requireSuperAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ success: false, message: 'Super admin only' });
  }
  next();
}
