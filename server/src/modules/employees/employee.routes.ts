import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  registerEmployeeSchema,
  updateEmployeeSchema,
  updateSelfContactSchema,
  updateSalarySchema,
  exitEmployeeSchema,
} from './employee.schema';
import {
  registerEmployee,
  listEmployees,
  getMyProfile,
  getEmployeeById,
  updateSelfContact,
  updateEmployee,
  exitEmployee,
  getEmployee360,
  updateSalary,
  getSalary,
  getImportTemplate,
  importEmployees,
  exportEmployees,
} from './employee.controller';
import { AppError } from '../../utils/AppError';

const router = Router();

// Multer in-memory configuration for CSV imports (max 1 MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024, // 1 MB
  },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.toLowerCase().endsWith('.csv')
    ) {
      cb(null, true);
    } else {
      cb(new AppError('Only CSV files (.csv or text/csv) are accepted', 422, 'INVALID_FILE_TYPE'));
    }
  },
});

function handleCsvUpload(req: Request, res: Response, next: NextFunction) {
  upload.single('file')(req, res, (err: any) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('File size exceeds the 1 MB limit', 413, 'FILE_TOO_LARGE'));
    }
    if (err) {
      return next(err);
    }
    next();
  });
}

// 1. Static and self routes (MUST precede /:id)
router.get('/me', authenticate, asyncHandler(getMyProfile));
router.patch(
  '/me/contact',
  authenticate,
  authorize('employee'),
  validate({ body: updateSelfContactSchema }),
  asyncHandler(updateSelfContact)
);

// 2. CSV Import/Export routes (HR only, defined before /:id)
router.get('/import/template', authenticate, authorize('hr'), asyncHandler(getImportTemplate));
router.post(
  '/import',
  authenticate,
  authorize('hr'),
  handleCsvUpload,
  asyncHandler(importEmployees)
);
router.get('/export', authenticate, authorize('hr'), asyncHandler(exportEmployees));

// 3. Collection routes
router.post(
  '/',
  authenticate,
  authorize('hr'),
  validate({ body: registerEmployeeSchema }),
  asyncHandler(registerEmployee)
);
router.get('/', authenticate, authorize('admin', 'hr', 'employee'), asyncHandler(listEmployees));

// 4. Employee salary management
router.get('/:id/salary', authenticate, authorize('admin', 'hr'), asyncHandler(getSalary));
router.put(
  '/:id/salary',
  authenticate,
  authorize('hr'),
  validate({ body: updateSalarySchema }),
  asyncHandler(updateSalary)
);

// 5. Employee 360 overview
router.get(
  '/:id/360',
  authenticate,
  authorize('admin', 'hr', 'employee'),
  asyncHandler(getEmployee360)
);

// 6. Lifecycle & exit management (HR only)
router.post(
  '/:id/exit',
  authenticate,
  authorize('hr'),
  validate({ body: exitEmployeeSchema }),
  asyncHandler(exitEmployee)
);

// 7. Individual employee member routes
router.get(
  '/:id',
  authenticate,
  authorize('admin', 'hr', 'employee'),
  asyncHandler(getEmployeeById)
);
router.patch(
  '/:id',
  authenticate,
  authorize('hr'),
  validate({ body: updateEmployeeSchema }),
  asyncHandler(updateEmployee)
);

export default router;
