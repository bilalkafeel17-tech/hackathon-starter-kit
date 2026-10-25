import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createLeaveTypeSchema,
  updateLeaveTypeSchema,
} from './leave-type.schema';
import {
  createLeaveType,
  listLeaveTypes,
  getLeaveTypeById,
  updateLeaveType,
  deactivateLeaveType,
  activateLeaveType,
  getSuggestions,
  applySuggestions,
} from './leave-type.controller';

const router = Router();

// Suggestions endpoints (Admin only) — declared before /:id routes
router.get('/suggestions', authenticate, authorize('admin'), asyncHandler(getSuggestions));
router.post('/apply-suggestions', authenticate, authorize('admin'), asyncHandler(applySuggestions));

// Read operations: all authenticated roles (needed by employees in leave request form)
router.get('/', authenticate, asyncHandler(listLeaveTypes));
router.get('/:id', authenticate, asyncHandler(getLeaveTypeById));

// Mutation operations: Admin only
router.post(
  '/',
  authenticate,
  authorize('admin'),
  validate({ body: createLeaveTypeSchema }),
  asyncHandler(createLeaveType)
);

router.patch(
  '/:id',
  authenticate,
  authorize('admin'),
  validate({ body: updateLeaveTypeSchema }),
  asyncHandler(updateLeaveType)
);

router.patch(
  '/:id/deactivate',
  authenticate,
  authorize('admin'),
  asyncHandler(deactivateLeaveType)
);

router.patch(
  '/:id/activate',
  authenticate,
  authorize('admin'),
  asyncHandler(activateLeaveType)
);

export default router;
