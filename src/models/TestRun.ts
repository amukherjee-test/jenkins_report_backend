import mongoose, { Document } from 'mongoose';

export interface ITestRunSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: number;
  durationMs: number;
}

export interface ITestRun extends Document {
  project: mongoose.Types.ObjectId;
  jobName: string;
  buildNumber: number;
  branch: string;
  commitHash: string;
  triggeredBy: string;
  status: 'in_progress' | 'passed' | 'failed' | 'unstable' | 'aborted';
  summary: ITestRunSummary;
  startedAt: Date;
  finishedAt?: Date;
  jenkinsUrl: string;
  artifacts: Array<{ name: string; path: string; size: number }>;
  createdAt: Date;
  updatedAt: Date;
}

const testRunSchema = new mongoose.Schema<ITestRun>(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    jobName: { type: String, required: true },
    buildNumber: { type: Number, required: true },
    branch: { type: String, default: 'unknown' },
    commitHash: { type: String, default: '' },
    triggeredBy: { type: String, default: '' },
    status: {
      type: String,
      enum: ['in_progress', 'passed', 'failed', 'unstable', 'aborted'],
      default: 'in_progress',
    },
    summary: {
      total: { type: Number, default: 0 },
      passed: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      passRate: { type: Number, default: 0 },
      durationMs: { type: Number, default: 0 },
    },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date },
    jenkinsUrl: { type: String, default: '' },
    artifacts: [{ name: String, path: String, size: Number }],
  },
  { timestamps: true }
);

testRunSchema.index({ project: 1, createdAt: -1 });
testRunSchema.index({ project: 1, jobName: 1, buildNumber: 1 }, { unique: true });
testRunSchema.index({ project: 1, status: 1 });
testRunSchema.index({ project: 1, 'summary.passRate': 1 });

export default mongoose.model<ITestRun>('TestRun', testRunSchema);
