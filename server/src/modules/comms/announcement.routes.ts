import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createAnnouncement,
  listAnnouncements,
  updateAnnouncement,
  deleteAnnouncement,
} from './comms.controller';

const router = Router();

const announcementInputSchema = z.object({
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(200),
  body: z.string().trim().min(2, 'Body must be at least 2 characters'),
  isPinned: z.boolean().optional(),
  expiresAt: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
});

const updateAnnouncementSchema = announcementInputSchema.partial();

// Read all active announcements (all authenticated users)
router.get('/', authenticate, asyncHandler(listAnnouncements));

// Create announcement (Admin and HR)
router.post(
  '/',
  authenticate,
  authorize('admin', 'hr'),
  validate({ body: announcementInputSchema }),
  asyncHandler(createAnnouncement)
);

// Update announcement (Admin or author HR)
router.patch(
  '/:id',
  authenticate,
  authorize('admin', 'hr'),
  validate({ body: updateAnnouncementSchema }),
  asyncHandler(updateAnnouncement)
);

// Delete announcement (Admin or author HR)
router.delete(
  '/:id',
  authenticate,
  authorize('admin', 'hr'),
  asyncHandler(deleteAnnouncement)
);

export default router;
