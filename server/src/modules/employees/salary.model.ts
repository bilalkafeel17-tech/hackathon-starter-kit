import { Schema, model, Document, Types } from 'mongoose';

export interface ISalaryStructure {
  employeeId: Types.ObjectId;
  basic: number;
  hra: number;
  medical: number;
  extraAllowance: number;
  gross: number;
  effectiveFrom: string;
  createdBy?: Types.ObjectId;
  createdAt: Date;
}

export interface ISalaryStructureDocument extends ISalaryStructure, Document {
  _id: Types.ObjectId;
}

const salaryStructureSchema = new Schema<ISalaryStructureDocument>(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    basic: {
      type: Number,
      required: true,
      min: 0.01,
      max: 99999999.99,
    },
    hra: {
      type: Number,
      required: true,
      min: 0,
    },
    medical: {
      type: Number,
      required: true,
      min: 0,
    },
    extraAllowance: {
      type: Number,
      default: 0,
      min: 0,
    },
    gross: {
      type: Number,
      required: true,
      min: 0,
    },
    effectiveFrom: {
      type: String,
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform: (_doc, ret: Record<string, any>) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

salaryStructureSchema.index({ employeeId: 1, effectiveFrom: -1 });

export const SalaryStructure = model<ISalaryStructureDocument>(
  'SalaryStructure',
  salaryStructureSchema
);
