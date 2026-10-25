import { Schema, model, Document, Types } from 'mongoose';

export type PayrollRunStatus = 'draft' | 'finalized';

export interface IPayrollTotals {
  gross: number;
  deductions: number;
  tax: number;
  net: number;
  employeeCount: number;
}

export interface IPayrollRun {
  month: string; // YYYY-MM
  status: PayrollRunStatus;
  createdBy: Types.ObjectId;
  finalizedBy?: Types.ObjectId;
  finalizedAt?: Date;
  totals: IPayrollTotals;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPayrollRunDocument extends IPayrollRun, Document {
  _id: Types.ObjectId;
}

const payrollRunSchema = new Schema<IPayrollRunDocument>(
  {
    month: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'finalized'],
      default: 'draft',
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    finalizedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    finalizedAt: {
      type: Date,
    },
    totals: {
      gross: { type: Number, default: 0 },
      deductions: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      net: { type: Number, default: 0 },
      employeeCount: { type: Number, default: 0 },
    },
    version: {
      type: Number,
      default: 1,
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

export const PayrollRun = model<IPayrollRunDocument>('PayrollRun', payrollRunSchema);

export interface IOneOffAdjustment {
  amount: number;
  reason: string;
}

export interface IPayrollItem {
  runId: Types.ObjectId;
  employeeId: Types.ObjectId;
  basic: number;
  hra: number;
  medical: number;
  extraAllowance: number;
  gross: number;
  workingDays: number;
  absentDays: number;
  unpaidLeaveDays: number;
  halfDays: number;
  lateCount: number;
  joinedProrationFactor: number;
  perDay: number;
  deductions: number;
  taxableAnnual: number;
  monthlyTax: number;
  net: number;
  oneOffAdjustment?: IOneOffAdjustment;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPayrollItemDocument extends IPayrollItem, Document {
  _id: Types.ObjectId;
}

const payrollItemSchema = new Schema<IPayrollItemDocument>(
  {
    runId: {
      type: Schema.Types.ObjectId,
      ref: 'PayrollRun',
      required: true,
      index: true,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    basic: { type: Number, required: true },
    hra: { type: Number, required: true },
    medical: { type: Number, required: true },
    extraAllowance: { type: Number, default: 0 },
    gross: { type: Number, required: true },
    workingDays: { type: Number, required: true },
    absentDays: { type: Number, default: 0 },
    unpaidLeaveDays: { type: Number, default: 0 },
    halfDays: { type: Number, default: 0 },
    lateCount: { type: Number, default: 0 },
    joinedProrationFactor: { type: Number, default: 1 },
    perDay: { type: Number, required: true },
    deductions: { type: Number, required: true },
    taxableAnnual: { type: Number, required: true },
    monthlyTax: { type: Number, required: true },
    net: { type: Number, required: true },
    oneOffAdjustment: {
      amount: { type: Number, default: 0 },
      reason: { type: String, trim: true },
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

payrollItemSchema.index({ runId: 1, employeeId: 1 }, { unique: true });

export const PayrollItem = model<IPayrollItemDocument>('PayrollItem', payrollItemSchema);
