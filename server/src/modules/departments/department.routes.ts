import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
} from './department.schema';
import {
  createDepartment,
  listDepartments,
  getDepartmentById,
  updateDepartment,
  deactivateDepartment,
  activateDepartment,
} from './department.controller';

const router = Router();

// Read operations: all authenticated roles
router.get('/', authenticate, asyncHandler(listDepartments));
router.get('/:id', authenticate, asyncHandler(getDepartmentById));

// Mutation operations: Admin only
router.post(
  '/',
  authenticate,
  authorize('admin'),
  validate({ body: createDepartmentSchema }),
  asyncHandler(createDepartment)
);

router.patch(
  '/:id',
  authenticate,
  authorize('admin'),
  validate({ body: updateDepartmentSchema }),
  asyncHandler(updateDepartment)
);

router.patch(
  '/:id/deactivate',
  authenticate,
  authorize('admin'),
  asyncHandler(deactivateDepartment)
);

router.patch(
  '/:id/activate',
  authenticate,
  authorize('admin'),
  asyncHandler(activateDepartment)
);

export default router;
