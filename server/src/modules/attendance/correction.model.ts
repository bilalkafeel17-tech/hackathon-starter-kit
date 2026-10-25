import { Schema, model, Document, Types } from 'mongoose';

export type CorrectionStatus = 'pending' | 'approved' | 'rejected';

export interface IAttendanceCorrection {
  employeeId: Types.ObjectId;
  dateKey: string;
  requestedCheckIn: string; // HH:mm
  requestedCheckOut?: string; // HH:mm
  reason: string;
  status: CorrectionStatus;
  decidedBy?: Types.ObjectId;
  decisionComment?: string;
  decidedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAttendanceCorrectionDocument extends IAttendanceCorrection, Document {
  _id: Types.ObjectId;
}

const attendanceCorrectionSchema = new Schema<IAttendanceCorrectionDocument>(
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
    requestedCheckIn: {
      type: String,
      required: true,
    },
    requestedCheckOut: {
      type: String,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    decidedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    decisionComment: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    decidedAt: {
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

// One pending correction per employee per dateKey
attendanceCorrectionSchema.index(
  { employeeId: 1, dateKey: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'pending' },
  }
);

export const AttendanceCorrection = model<IAttendanceCorrectionDocument>(
  'AttendanceCorrection',
  attendanceCorrectionSchema
);
