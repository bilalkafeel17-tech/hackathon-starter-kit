import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middleware/auth';
import {
  listPayslips,
  getPayslip,
  getPayslipPdf,
} from './payroll.controller';

const router = Router();

// Payslip retrieval and PDF downloads (scoping enforced inside controller/service)
router.get('/', authenticate, asyncHandler(listPayslips));
router.get('/:id', authenticate, asyncHandler(getPayslip));
router.get('/:id/pdf', authenticate, asyncHandler(getPayslipPdf));

export default router;
