import { Schema, model, Document, Types } from 'mongoose';

export interface IAiLog {
  userId: Types.ObjectId;
  role: string;
  endpoint: string;
  promptLength: number;
  toolsUsed: string[];
  latencyMs: number;
  success: boolean;
  error?: string;
  createdAt: Date;
}

export interface IAiLogDocument extends IAiLog, Document {
  _id: Types.ObjectId;
}

const aiLogSchema = new Schema<IAiLogDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      required: true,
    },
    endpoint: {
      type: String,
      required: true,
    },
    promptLength: {
      type: Number,
      required: true,
    },
    toolsUsed: {
      type: [String],
      default: [],
    },
    latencyMs: {
      type: Number,
      required: true,
    },
    success: {
      type: Boolean,
      required: true,
    },
    error: {
      type: String,
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

export const AiLog = model<IAiLogDocument>('AiLog', aiLogSchema);
