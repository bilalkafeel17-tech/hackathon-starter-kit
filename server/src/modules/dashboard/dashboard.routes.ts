import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate, authorize } from '../../middleware/auth';
import {
  getHrDashboard,
  getAdminDashboard,
  getEmployeeDashboard,
} from './dashboard.controller';

const router = Router();

router.get('/hr', authenticate, authorize('hr'), asyncHandler(getHrDashboard));
router.get('/admin', authenticate, authorize('admin'), asyncHandler(getAdminDashboard));
router.get('/employee', authenticate, authorize('employee'), asyncHandler(getEmployeeDashboard));

export default router;
