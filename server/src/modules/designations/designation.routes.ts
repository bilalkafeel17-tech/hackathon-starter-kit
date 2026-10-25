import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createDesignationSchema,
  updateDesignationSchema,
} from './designation.schema';
import {
  createDesignation,
  listDesignations,
  getDesignationById,
  updateDesignation,
  deactivateDesignation,
  activateDesignation,
} from './designation.controller';

const router = Router();

// Read operations: all authenticated roles
router.get('/', authenticate, asyncHandler(listDesignations));
router.get('/:id', authenticate, asyncHandler(getDesignationById));

// Mutation operations: Admin only
router.post(
  '/',
  authenticate,
  authorize('admin'),
  validate({ body: createDesignationSchema }),
  asyncHandler(createDesignation)
);

router.patch(
  '/:id',
  authenticate,
  authorize('admin'),
  validate({ body: updateDesignationSchema }),
  asyncHandler(updateDesignation)
);

router.patch(
  '/:id/deactivate',
  authenticate,
  authorize('admin'),
  asyncHandler(deactivateDesignation)
);

router.patch(
  '/:id/activate',
  authenticate,
  authorize('admin'),
  asyncHandler(activateDesignation)
);

export default router;
