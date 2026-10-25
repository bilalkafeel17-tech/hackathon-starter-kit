import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { generateRunSchema, adjustItemSchema } from './payroll.schema';
import {
  generateRun,
  listRuns,
  getRunById,
  finalizeRun,
  adjustItem,
} from './payroll.controller';

const router = Router();

// Payroll runs management
router.post(
  '/runs',
  authenticate,
  authorize('hr'),
  validate({ body: generateRunSchema }),
  asyncHandler(generateRun)
);
router.get('/runs', authenticate, authorize('admin', 'hr'), asyncHandler(listRuns));
router.get('/runs/:id', authenticate, authorize('admin', 'hr'), asyncHandler(getRunById));

// Finalize run (Admin only locks)
router.post(
  '/runs/:id/finalize',
  authenticate,
  authorize('admin'),
  asyncHandler(finalizeRun)
);

// One-off adjustment (HR only while in draft)
router.patch(
  '/runs/:id/items/:itemId',
  authenticate,
  authorize('hr'),
  validate({ body: adjustItemSchema }),
  asyncHandler(adjustItem)
);

export default router;
