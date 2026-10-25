import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { updateSettingsSchema } from './settings.schema';
import {
  getSettings,
  getPublicSettings,
  updateSettings,
} from './settings.controller';

const router = Router();

// Public rules subset for all authenticated users (needed by employee self-service forms)
router.get('/public', authenticate, asyncHandler(getPublicSettings));

// Full settings with office coordinates (Admin and HR only)
router.get('/', authenticate, authorize('admin', 'hr'), asyncHandler(getSettings));

// Settings modification (Admin only)
router.patch(
  '/',
  authenticate,
  authorize('admin'),
  validate({ body: updateSettingsSchema }),
  asyncHandler(updateSettings)
);

export default router;
