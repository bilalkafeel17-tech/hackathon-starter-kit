import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  applyLeaveSchema,
  approveLeaveSchema,
  rejectLeaveSchema,
} from './leave.schema';
import {
  applyLeave,
  getMyLeaves,
  getBalance,
  listLeaves,
  cancelLeave,
  approveLeave,
  rejectLeave,
} from './leave.controller';

const router = Router();

// 1. Employee personal leave routes (defined before /:id)
router.post(
  '/',
  authenticate,
  authorize('employee'),
  validate({ body: applyLeaveSchema }),
  asyncHandler(applyLeave)
);
router.get('/my', authenticate, asyncHandler(getMyLeaves));
router.get('/balance', authenticate, asyncHandler(getBalance));

// 2. Organization wide leave management (HR and Admin)
router.get('/', authenticate, authorize('admin', 'hr'), asyncHandler(listLeaves));

// 3. Status updates & cancellation
router.patch('/:id/cancel', authenticate, asyncHandler(cancelLeave));
router.patch(
  '/:id/approve',
  authenticate,
  authorize('hr'),
  validate({ body: approveLeaveSchema }),
  asyncHandler(approveLeave)
);
router.patch(
  '/:id/reject',
  authenticate,
  authorize('hr'),
  validate({ body: rejectLeaveSchema }),
  asyncHandler(rejectLeave)
);

export default router;
