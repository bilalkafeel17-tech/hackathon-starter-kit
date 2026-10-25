import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middleware/auth';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from './comms.controller';

const router = Router();

router.get('/', authenticate, asyncHandler(getNotifications));
router.patch('/read-all', authenticate, asyncHandler(markAllNotificationsRead));
router.patch('/:id/read', authenticate, asyncHandler(markNotificationRead));

export default router;
