import mongoose, { Document } from 'mongoose';

export interface ITestHistory extends Document {
  project: mongoose.Types.ObjectId;
  testKey: string;
  suiteName: string;
  testName: string;
  totalRuns: number;
  passed: number;
  failed: number;
  skipped: number;
  lastStatuses: string[];
  flakeScore: number;
  avgDurationMs: number;
  lastRunAt?: Date;
  lastStatus?: string;
  createdAt: Date;
  updatedAt: Date;
}

const testHistorySchema = new mongoose.Schema<ITestHistory>(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    testKey: { type: String, required: true },
    suiteName: { type: String, required: true },
    testName: { type: String, required: true },
    totalRuns: { type: Number, default: 0 },
    passed: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    lastStatuses: { type: [String], default: [] },
    flakeScore: { type: Number, default: 0 },
    avgDurationMs: { type: Number, default: 0 },
    lastRunAt: { type: Date },
    lastStatus: { type: String },
  },
  { timestamps: true }
);

testHistorySchema.index({ project: 1, testKey: 1 }, { unique: true });
testHistorySchema.index({ project: 1, flakeScore: -1 });
testHistorySchema.index({ project: 1, failed: -1 });
testHistorySchema.index({ project: 1, avgDurationMs: -1 });

export default mongoose.model<ITestHistory>('TestHistory', testHistorySchema);
