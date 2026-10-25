import { Schema, model, Document } from 'mongoose';

export interface ICounter {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false }
);

export const Counter = model<ICounter>('Counter', counterSchema);

/**
 * Atomically generates the next employee code in the format EMP-0001, EMP-0002, etc.
 */
export async function getNextEmployeeCode(): Promise<string> {
  const counter = await Counter.findByIdAndUpdate(
    'employeeCode',
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `EMP-${String(counter.seq).padStart(4, '0')}`;
}
