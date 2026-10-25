import { Schema, model, Document } from 'mongoose';

export interface ILeaveType extends Document {
  name: string;
  code: string;
  yearlyQuota: number | null;
  isPaid: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const leaveTypeSchema = new Schema<ILeaveType>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    yearlyQuota: {
      type: Number,
      default: null, // null represents unlimited quota
    },
    isPaid: {
      type: Boolean,
      required: true,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const LeaveType = model<ILeaveType>('LeaveType', leaveTypeSchema);
