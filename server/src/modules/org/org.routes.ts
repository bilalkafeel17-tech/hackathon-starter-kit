import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate, authorize } from '../../middleware/auth';
import { getReadiness } from './org.controller';

const router = Router();

// Readiness checklist: Admin and HR
router.get('/readiness', authenticate, authorize('admin', 'hr'), asyncHandler(getReadiness));

export default router;
