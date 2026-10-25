import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { authLimiter } from '../../middleware/rateLimiter';
import { authenticate } from '../../middleware/auth';
import { loginSchema, changePasswordSchema } from './auth.schema';
import {
  login,
  getMe,
  logout,
  logoutAll,
  changePassword,
} from './auth.controller';

const router = Router();

router.post('/login', authLimiter, validate({ body: loginSchema }), asyncHandler(login));
router.get('/me', authenticate, asyncHandler(getMe));
router.post('/logout', authenticate, asyncHandler(logout));
router.post('/logout-all', authenticate, asyncHandler(logoutAll));
router.post(
  '/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  asyncHandler(changePassword)
);

export default router;
