import { Types } from 'mongoose';
import { Notification, INotificationDocument } from './notification.model';
import { User } from '../users/user.model';
import { AppError } from '../../utils/AppError';

export interface CreateNotificationData {
  userId: Types.ObjectId | string;
  type: string;
  title: string;
  message: string;
  link?: string;
}

export class NotificationService {
  async createNotification(data: CreateNotificationData): Promise<INotificationDocument> {
    return Notification.create({
      userId: new Types.ObjectId(data.userId),
      type: data.type,
      title: data.title,
      message: data.message,
      link: data.link,
      readAt: null,
    });
  }

  async notifyRole(
    role: string,
    data: Omit<CreateNotificationData, 'userId'>
  ): Promise<void> {
    const users = await User.find({ role, isActive: true }).select('_id');
    if (users.length === 0) return;

    await Notification.insertMany(
      users.map((u) => ({
        userId: u._id,
        type: data.type,
        title: data.title,
        message: data.message,
        link: data.link,
        readAt: null,
      }))
    );
  }

  async notifyAll(data: Omit<CreateNotificationData, 'userId'>): Promise<void> {
    const users = await User.find({ isActive: true }).select('_id');
    if (users.length === 0) return;

    await Notification.insertMany(
      users.map((u) => ({
        userId: u._id,
        type: data.type,
        title: data.title,
        message: data.message,
        link: data.link,
        readAt: null,
      }))
    );
  }

  async getMyNotifications(userId: string, page = 1, limit = 20) {
    const userObjectId = new Types.ObjectId(userId);
    const skip = (page - 1) * limit;

    const [notifications, unreadCount, total] = await Promise.all([
      Notification.find({ userId: userObjectId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments({ userId: userObjectId, readAt: null }),
      Notification.countDocuments({ userId: userObjectId }),
    ]);

    return {
      notifications,
      unreadCount,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async markAsRead(notificationId: string, userId: string): Promise<INotificationDocument> {
    const notification = await Notification.findOne({
      _id: notificationId,
      userId: new Types.ObjectId(userId),
    });

    if (!notification) {
      throw AppError.notFound('Notification');
    }

    notification.readAt = new Date();
    await notification.save();
    return notification;
  }

  async markAllAsRead(userId: string): Promise<{ modifiedCount: number }> {
    const res = await Notification.updateMany(
      { userId: new Types.ObjectId(userId), readAt: null },
      { $set: { readAt: new Date() } }
    );
    return { modifiedCount: res.modifiedCount };
  }
}

export const notificationService = new NotificationService();
