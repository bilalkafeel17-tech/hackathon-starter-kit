import { Schema, model, Document } from 'mongoose';
import { isValidDateKey } from '../../utils/date';

export interface IHoliday extends Document {
  name: string;
  date: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const holidaySchema = new Schema<IHoliday>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: String,
      required: true,
      unique: true,
      index: true,
      validate: {
        validator: isValidDateKey,
        message: 'Holiday date must be a valid calendar date in YYYY-MM-DD format',
      },
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

export const Holiday = model<IHoliday>('Holiday', holidaySchema);
