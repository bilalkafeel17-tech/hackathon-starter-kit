import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Role } from '../constants/roles';
import { AppError } from '../utils/AppError';
import { verifyToken, JwtPayload } from '../utils/jwt';
import { User, IUserDocument } from '../modules/users/user.model';

// Routes permitted while mustChangePassword is true
const PASSWORD_CHANGE_ALLOWED_ROUTES = [
  '/api/auth/me',
  '/api/auth/change-password',
  '/api/auth/logout',
];

function isRouteExemptFromPasswordChange(req: Request): boolean {
  const fullPath = (req.baseUrl + req.path).replace(/\/+$/, '');
  return PASSWORD_CHANGE_ALLOWED_ROUTES.some((allowed) => fullPath === allowed);
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Authentication token is required', 401, 'TOKEN_MISSING'));
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return next(new AppError('Authentication token is required', 401, 'TOKEN_MISSING'));
  }

  let payload: JwtPayload;
  try {
    payload = verifyToken(token);
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Authentication token has expired', 401, 'TOKEN_EXPIRED'));
    }
    return next(new AppError('Invalid authentication token', 401, 'TOKEN_INVALID'));
  }

  const user = await User.findById(payload.sub).select(
    '+tokenVersion +isActive +mustChangePassword'
  );

  if (!user) {
    return next(new AppError('User account not found', 401, 'TOKEN_INVALID'));
  }

  if (!user.isActive) {
    return next(new AppError('Account is disabled', 401, 'ACCOUNT_DISABLED'));
  }

  if (user.tokenVersion !== payload.tokenVersion) {
    return next(new AppError('Session invalidated — please log in again', 401, 'TOKEN_INVALID'));
  }

  // Enforce mandatory password change
  if (user.mustChangePassword && !isRouteExemptFromPasswordChange(req)) {
    return next(
      new AppError(
        'Password change required before accessing this resource',
        403,
        'PASSWORD_CHANGE_REQUIRED'
      )
    );
  }

  req.user = user;
  next();
}

export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError('Insufficient permissions for this resource', 403, 'FORBIDDEN'));
    }

    next();
  };
}

/**
 * Data Scope Access Control:
 *
 * All domain queries (attendance, leave, payroll, AI tools) must scope their database
 * operations through getScope(user).
 *
 * Rules:
 * 1. Admin and HR have global visibility: returns an empty filter {}.
 * 2. Employee is strictly restricted to their own records: returns { employeeId: user.employeeId }.
 * 3. An employee without a linked employeeId is strictly denied (throws 403), never
 *    treated as unrestricted.
 */
export function getScope(user: IUserDocument): Record<string, unknown> {
  if (user.role === 'admin' || user.role === 'hr') {
    return {};
  }

  if (user.role === 'employee') {
    if (!user.employeeId) {
      throw AppError.forbidden('Employee profile is not linked to this account');
    }
    return { employeeId: user.employeeId };
  }

  throw AppError.forbidden('Access denied');
}

/**
 * Enforces that an employee can only read/modify their own record.
 * Throws 403 FORBIDDEN if an employee attempts to access another employee's record.
 * Admin and HR bypass this check.
 */
export function assertCanAccessEmployee(
  user: IUserDocument,
  targetEmployeeId: string | Types.ObjectId
): void {
  if (user.role === 'admin' || user.role === 'hr') {
    return;
  }

  if (user.role === 'employee') {
    if (!user.employeeId) {
      throw AppError.forbidden('Employee profile is not linked to this account');
    }
    const targetStr = targetEmployeeId.toString();
    const userStr = user.employeeId.toString();
    if (targetStr !== userStr) {
      throw AppError.forbidden('Access denied: cannot view or modify other employee records');
    }
    return;
  }

  throw AppError.forbidden('Access denied');
}
