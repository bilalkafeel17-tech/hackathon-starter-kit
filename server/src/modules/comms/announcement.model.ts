import { Schema, model, Document, Types } from 'mongoose';

export interface IAnnouncement {
  title: string;
  body: string;
  authorId: Types.ObjectId;
  isPinned: boolean;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAnnouncementDocument extends IAnnouncement, Document {
  _id: Types.ObjectId;
}

const announcementSchema = new Schema<IAnnouncementDocument>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
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

announcementSchema.index({ isPinned: -1, createdAt: -1 });

export const Announcement = model<IAnnouncementDocument>('Announcement', announcementSchema);
