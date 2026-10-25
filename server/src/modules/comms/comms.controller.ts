import { Request, Response } from 'express';
import { announcementService } from './announcement.service';
import { notificationService } from './notification.service';
import { sendSuccess } from '../../utils/response';

export async function createAnnouncement(req: Request, res: Response): Promise<void> {
  const result = await announcementService.create(req.body, req.user!, req);
  sendSuccess(res, result, 201);
}

export async function listAnnouncements(_req: Request, res: Response): Promise<void> {
  const announcements = await announcementService.list();
  sendSuccess(res, announcements);
}

export async function updateAnnouncement(req: Request, res: Response): Promise<void> {
  const result = await announcementService.update(req.params.id as string, req.body, req.user!, req);
  sendSuccess(res, result);
}

export async function deleteAnnouncement(req: Request, res: Response): Promise<void> {
  const result = await announcementService.delete(req.params.id as string, req.user!, req);
  sendSuccess(res, result);
}

export async function getNotifications(req: Request, res: Response): Promise<void> {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const result = await notificationService.getMyNotifications(req.user!._id.toString(), page, limit);
  sendSuccess(res, result.notifications, 200, {
    ...result.meta,
    unreadCount: result.unreadCount,
  });
}

export async function markNotificationRead(req: Request, res: Response): Promise<void> {
  const result = await notificationService.markAsRead(req.params.id as string, req.user!._id.toString());
  sendSuccess(res, result);
}

export async function markAllNotificationsRead(req: Request, res: Response): Promise<void> {
  const result = await notificationService.markAllAsRead(req.user!._id.toString());
  sendSuccess(res, result);
}
