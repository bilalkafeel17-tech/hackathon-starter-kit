import { Schema, model, Document, Types } from 'mongoose';

export interface INotification {
  userId: Types.ObjectId;
  type: string;
  title: string;
  message: string;
  link?: string;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface INotificationDocument extends INotification, Document {
  _id: Types.ObjectId;
}

const notificationSchema = new Schema<INotificationDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    link: {
      type: String,
      trim: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, any>) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });

export const Notification = model<INotificationDocument>('Notification', notificationSchema);
