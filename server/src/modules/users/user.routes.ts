import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createHrUserSchema, updateUserSchema } from './user.schema';
import {
  createHrUser,
  listUsers,
  getUserById,
  updateUser,
  deactivateUser,
  activateUser,
  resetUserPassword,
} from './user.controller';

const router = Router();

// All user management routes are strictly Admin only
router.use(authenticate, authorize('admin'));

router.get('/', asyncHandler(listUsers));
router.get('/:id', asyncHandler(getUserById));

router.post(
  '/',
  validate({ body: createHrUserSchema }),
  asyncHandler(createHrUser)
);

router.patch(
  '/:id',
  validate({ body: updateUserSchema }),
  asyncHandler(updateUser)
);

router.patch('/:id/deactivate', asyncHandler(deactivateUser));
router.patch('/:id/activate', asyncHandler(activateUser));
router.post('/:id/reset-password', asyncHandler(resetUserPassword));

export default router;
