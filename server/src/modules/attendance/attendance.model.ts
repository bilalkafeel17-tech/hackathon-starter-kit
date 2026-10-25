import { Schema, model, Document, Types } from 'mongoose';

export type AttendanceStatus =
  | 'present'
  | 'late'
  | 'half_day'
  | 'absent'
  | 'on_leave'
  | 'missing_checkout'
  | 'holiday'
  | 'weekend';

export type AttendanceSource = 'web' | 'camera' | 'correction';

export interface AttendanceLocation {
  lat?: number;
  lng?: number;
  accuracy?: number;
  distanceMeters?: number;
}

export interface AttendanceRulesSnapshot {
  officeStart: string;
  graceMinutes: number;
  halfDayHours: number;
  weekendDays: number[];
  timezone: string;
  version: number;
}

export interface IAttendance {
  employeeId: Types.ObjectId;
  dateKey: string; // YYYY-MM-DD
  checkInAt?: Date;
  checkOutAt?: Date;
  status: AttendanceStatus;
  workedMinutes: number;
  source: AttendanceSource;
  location?: AttendanceLocation;
  rulesSnapshot: AttendanceRulesSnapshot;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAttendanceDocument extends IAttendance, Document {
  _id: Types.ObjectId;
}

const attendanceSchema = new Schema<IAttendanceDocument>(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    dateKey: {
      type: String,
      required: true,
      index: true,
    },
    checkInAt: {
      type: Date,
    },
    checkOutAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: [
        'present',
        'late',
        'half_day',
        'absent',
        'on_leave',
        'missing_checkout',
        'holiday',
        'weekend',
      ],
      required: true,
      index: true,
    },
    workedMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    source: {
      type: String,
      enum: ['web', 'camera', 'correction'],
      default: 'web',
    },
    location: {
      lat: Number,
      lng: Number,
      accuracy: Number,
      distanceMeters: Number,
    },
    rulesSnapshot: {
      officeStart: { type: String, required: true },
      graceMinutes: { type: Number, required: true },
      halfDayHours: { type: Number, required: true },
      weekendDays: { type: [Number], required: true },
      timezone: { type: String, required: true },
      version: { type: Number, required: true },
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

// Unique index enforcing one attendance record per employee per day
attendanceSchema.index({ employeeId: 1, dateKey: 1 }, { unique: true });

export const Attendance = model<IAttendanceDocument>('Attendance', attendanceSchema);
