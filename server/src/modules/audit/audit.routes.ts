import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate, authorize } from '../../middleware/auth';
import { listAuditLogs } from './audit.controller';

const router = Router();

router.get('/', authenticate, authorize('admin'), asyncHandler(listAuditLogs));

export default router;
