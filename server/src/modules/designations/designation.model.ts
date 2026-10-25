import { Schema, model, Document, Types } from 'mongoose';

export interface IDesignation extends Document {
  title: string;
  titleKey: string;
  departmentId?: Types.ObjectId | null;
  level?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const designationSchema = new Schema<IDesignation>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    titleKey: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    level: {
      type: String,
      trim: true,
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

// Compound unique index on case-insensitive title and department
designationSchema.index({ titleKey: 1, departmentId: 1 }, { unique: true });

export const Designation = model<IDesignation>('Designation', designationSchema);
