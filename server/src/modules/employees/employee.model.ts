import { Schema, model, Document, Types } from 'mongoose';

export type Gender = 'male' | 'female' | 'other';
export type EmploymentType = 'full_time' | 'part_time' | 'contract';
export type EmployeeStatus = 'probation' | 'active' | 'exited';

export interface IEmergencyContact {
  name?: string;
  phone?: string;
  relation?: string;
}

export interface IEmployee {
  employeeCode: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  gender?: Gender;
  dateOfBirth?: string;
  joiningDate: string;
  departmentId: Types.ObjectId;
  designationId: Types.ObjectId;
  employmentType: EmploymentType;
  status: EmployeeStatus;
  probationEndDate?: string;
  exitDate?: string;
  exitReason?: string;
  userId: Types.ObjectId;
  emergencyContact?: IEmergencyContact;
  searchKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEmployeeDocument extends IEmployee, Document {
  _id: Types.ObjectId;
}

const emergencyContactSchema = new Schema<IEmergencyContact>(
  {
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    relation: { type: String, trim: true },
  },
  { _id: false }
);

const employeeSchema = new Schema<IEmployeeDocument>(
  {
    employeeCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      immutable: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
    },
    dateOfBirth: {
      type: String,
    },
    joiningDate: {
      type: String,
      required: true,
      index: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },
    designationId: {
      type: Schema.Types.ObjectId,
      ref: 'Designation',
      required: true,
      index: true,
    },
    employmentType: {
      type: String,
      enum: ['full_time', 'part_time', 'contract'],
      default: 'full_time',
      index: true,
    },
    status: {
      type: String,
      enum: ['probation', 'active', 'exited'],
      default: 'probation',
      index: true,
    },
    probationEndDate: {
      type: String,
    },
    exitDate: {
      type: String,
    },
    exitReason: {
      type: String,
      trim: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    emergencyContact: emergencyContactSchema,
    searchKey: {
      type: String,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, any>) => {
        delete ret.__v;
        delete ret.searchKey;
        return ret;
      },
    },
  }
);

employeeSchema.pre('save', function (next) {
  this.searchKey = `${this.employeeCode} ${this.name} ${this.email}`.toLowerCase();
  next();
});

export const Employee = model<IEmployeeDocument>('Employee', employeeSchema);
