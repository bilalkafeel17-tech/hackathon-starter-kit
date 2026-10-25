import { Schema, model, Document, Types } from 'mongoose';

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface ILeave {
  employeeId: Types.ObjectId;
  leaveTypeId: Types.ObjectId;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  workingDays: number;
  reason: string;
  status: LeaveStatus;
  decidedBy?: Types.ObjectId;
  decisionComment?: string;
  decidedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILeaveDocument extends ILeave, Document {
  _id: Types.ObjectId;
}

const leaveSchema = new Schema<ILeaveDocument>(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    leaveTypeId: {
      type: Schema.Types.ObjectId,
      ref: 'LeaveType',
      required: true,
      index: true,
    },
    startDate: {
      type: String,
      required: true,
      index: true,
    },
    endDate: {
      type: String,
      required: true,
      index: true,
    },
    workingDays: {
      type: Number,
      required: true,
      min: 0.5,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
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

leaveSchema.index({ employeeId: 1, startDate: 1, endDate: 1 });

export const Leave = model<ILeaveDocument>('Leave', leaveSchema);
