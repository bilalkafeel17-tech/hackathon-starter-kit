import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { setupCompanySchema } from './setup.schema';
import { getSetupStatus, setupCompany } from './setup.controller';

const router = Router();

router.get('/status', asyncHandler(getSetupStatus));
router.post('/', validate({ body: setupCompanySchema }), asyncHandler(setupCompany));

export default router;
