import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createHolidaySchema,
  bulkHolidaysSchema,
  updateHolidaySchema,
} from './holiday.schema';
import {
  createHoliday,
  bulkCreateHolidays,
  listHolidays,
  getHolidayById,
  updateHoliday,
  deleteHoliday,
} from './holiday.controller';

const router = Router();

// Bulk creation (Admin only) — declared before /:id routes
router.post(
  '/bulk',
  authenticate,
  authorize('admin'),
  validate({ body: bulkHolidaysSchema }),
  asyncHandler(bulkCreateHolidays)
);

// Read operations: all authenticated roles
router.get('/', authenticate, asyncHandler(listHolidays));
router.get('/:id', authenticate, asyncHandler(getHolidayById));

// Mutation operations: Admin only
router.post(
  '/',
  authenticate,
  authorize('admin'),
  validate({ body: createHolidaySchema }),
  asyncHandler(createHoliday)
);

router.patch(
  '/:id',
  authenticate,
  authorize('admin'),
  validate({ body: updateHolidaySchema }),
  asyncHandler(updateHoliday)
);

router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  asyncHandler(deleteHoliday)
);

export default router;
