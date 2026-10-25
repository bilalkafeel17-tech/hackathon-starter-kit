import { Schema, model, Document, Types } from 'mongoose';

export interface ISettings extends Document {
  key: string;
  companyName: string;
  officeStart: string;
  graceMinutes: number;
  halfDayHours: number;
  weekendDays: number[];
  timezone: string;
  version: number;
  updatedBy?: Types.ObjectId;
  office?: {
    lat?: number;
    lng?: number;
    radiusMeters: number;
  };
  setupCompletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const settingsSchema = new Schema<ISettings>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'company',
      immutable: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    officeStart: {
      type: String,
      default: '09:00',
    },
    graceMinutes: {
      type: Number,
      default: 15,
    },
    halfDayHours: {
      type: Number,
      default: 5,
    },
    weekendDays: {
      type: [Number],
      default: [0, 6],
    },
    timezone: {
      type: String,
      default: 'Asia/Karachi',
    },
    version: {
      type: Number,
      default: 1,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    office: {
      lat: { type: Number },
      lng: { type: Number },
      radiusMeters: { type: Number, default: 150 },
    },
    setupCompletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export const Settings = model<ISettings>('Settings', settingsSchema);
