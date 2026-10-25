import { Router } from 'express';
import { aiController } from './ai.controller';
import { chatBodySchema, dashboardSummaryBodySchema, smartLeaveBodySchema } from './ai.schema';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';

const router = Router();

router.use(authenticate);

// Chat completion with tool calling (all authenticated users)
router.post('/chat', validate({ body: chatBodySchema }), aiController.chat);

// Dashboard KPI summary for HR and Admin
router.post(
  '/dashboard-summary',
  authorize('admin', 'hr'),
  validate({ body: dashboardSummaryBodySchema }),
  aiController.getDashboardSummary
);

// Smart leave natural language parser (never saves)
router.post('/smart-leave', validate({ body: smartLeaveBodySchema }), aiController.smartLeave);

export default router;
