import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  checkInSchema,
  checkOutSchema,
  createCorrectionSchema,
  approveCorrectionSchema,
  rejectCorrectionSchema,
} from './attendance.schema';
import {
  checkIn,
  checkOut,
  getToday,
  getMyAttendance,
  getBoard,
  createCorrection,
  listCorrections,
  approveCorrection,
  rejectCorrection,
} from './attendance.controller';

const router = Router();

// 1. Employee punch & widget status
router.post('/check-in', authenticate, validate({ body: checkInSchema }), asyncHandler(checkIn));
router.post('/check-out', authenticate, validate({ body: checkOutSchema }), asyncHandler(checkOut));
router.get('/today', authenticate, asyncHandler(getToday));
router.get('/my', authenticate, asyncHandler(getMyAttendance));

// 2. Organization attendance board (HR and Admin)
router.get('/board', authenticate, authorize('admin', 'hr'), asyncHandler(getBoard));

// 3. Attendance corrections
router.post(
  '/corrections',
  authenticate,
  validate({ body: createCorrectionSchema }),
  asyncHandler(createCorrection)
);
router.get('/corrections', authenticate, asyncHandler(listCorrections));
router.patch(
  '/corrections/:id/approve',
  authenticate,
  authorize('hr'),
  validate({ body: approveCorrectionSchema }),
  asyncHandler(approveCorrection)
);
router.patch(
  '/corrections/:id/reject',
  authenticate,
  authorize('hr'),
  validate({ body: rejectCorrectionSchema }),
  asyncHandler(rejectCorrection)
);

export default router;
