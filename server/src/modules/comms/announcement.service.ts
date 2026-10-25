import { Request } from 'express';
import { Types } from 'mongoose';
import { Announcement, IAnnouncementDocument } from './announcement.model';
import { notificationService } from './notification.service';
import { AppError } from '../../utils/AppError';
import { auditService } from '../audit/audit.service';
import { IUserDocument } from '../users/user.model';

export interface CreateAnnouncementInput {
  title: string;
  body: string;
  isPinned?: boolean;
  expiresAt?: string | Date;
}

export interface UpdateAnnouncementInput {
  title?: string;
  body?: string;
  isPinned?: boolean;
  expiresAt?: string | Date;
}

export class AnnouncementService {
  async create(
    data: CreateAnnouncementInput,
    author: IUserDocument,
    req?: Request
  ): Promise<IAnnouncementDocument> {
    const announcement = await Announcement.create({
      title: data.title.trim(),
      body: data.body.trim(),
      authorId: author._id,
      isPinned: Boolean(data.isPinned),
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
    });

    // Notify all active users about new announcement
    await notificationService.notifyAll({
      type: 'announcement_posted',
      title: 'Company Announcement',
      message: announcement.title,
      link: '/announcements',
    });

    await auditService.log({
      req,
      action: 'ANNOUNCEMENT_CREATED',
      entity: 'Announcement',
      entityId: announcement._id.toString(),
      after: {
        title: announcement.title,
        isPinned: announcement.isPinned,
        author: author.name,
      },
    });

    return announcement;
  }

  async list(): Promise<IAnnouncementDocument[]> {
    const now = new Date();
    return Announcement.find({
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }],
    })
      .populate('authorId', 'name role')
      .sort({ isPinned: -1, createdAt: -1 })
      .exec();
  }

  async update(
    id: string,
    data: UpdateAnnouncementInput,
    currentUser: IUserDocument,
    req?: Request
  ): Promise<IAnnouncementDocument> {
    const announcement = await Announcement.findById(id);
    if (!announcement) {
      throw AppError.notFound('Announcement');
    }

    // Permission check: Admin can edit any; HR only their own
    if (currentUser.role !== 'admin' && announcement.authorId.toString() !== currentUser._id.toString()) {
      throw AppError.forbidden('You can only edit announcements you authored');
    }

    if (data.title !== undefined) announcement.title = data.title.trim();
    if (data.body !== undefined) announcement.body = data.body.trim();
    if (data.isPinned !== undefined) announcement.isPinned = data.isPinned;
    if (data.expiresAt !== undefined) {
      announcement.expiresAt = data.expiresAt ? new Date(data.expiresAt) : undefined;
    }

    await announcement.save();

    await auditService.log({
      req,
      action: 'ANNOUNCEMENT_UPDATED',
      entity: 'Announcement',
      entityId: announcement._id.toString(),
      after: {
        title: announcement.title,
        isPinned: announcement.isPinned,
      },
    });

    return announcement;
  }

  async delete(
    id: string,
    currentUser: IUserDocument,
    req?: Request
  ): Promise<{ message: string }> {
    const announcement = await Announcement.findById(id);
    if (!announcement) {
      throw AppError.notFound('Announcement');
    }

    if (currentUser.role !== 'admin' && announcement.authorId.toString() !== currentUser._id.toString()) {
      throw AppError.forbidden('You can only delete announcements you authored');
    }

    await Announcement.deleteOne({ _id: announcement._id });

    await auditService.log({
      req,
      action: 'ANNOUNCEMENT_DELETED',
      entity: 'Announcement',
      entityId: announcement._id.toString(),
      before: {
        title: announcement.title,
      },
    });

    return { message: 'Announcement deleted successfully' };
  }
}

export const announcementService = new AnnouncementService();
