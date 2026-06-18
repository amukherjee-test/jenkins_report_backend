import mongoose, { Document } from 'mongoose';

export interface ITestCase extends Document {
  project: mongoose.Types.ObjectId;
  run: mongoose.Types.ObjectId;
  suiteName: string;
  testName: string;
  testKey: string;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  durationMs: number;
  errorMessage: string;
  stackTrace: string;
  stdOut: string;
  stdErr: string;
  createdAt: Date;
  updatedAt: Date;
}

const testCaseSchema = new mongoose.Schema<ITestCase>(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    run: { type: mongoose.Schema.Types.ObjectId, ref: 'TestRun', required: true },
    suiteName: { type: String, required: true },
    testName: { type: String, required: true },
    testKey: { type: String, required: true },
    status: { type: String, enum: ['passed', 'failed', 'skipped', 'error'], required: true },
    durationMs: { type: Number, default: 0 },
    errorMessage: { type: String, default: '' },
    stackTrace: { type: String, default: '' },
    stdOut: { type: String, default: '' },
    stdErr: { type: String, default: '' },
  },
  { timestamps: true }
);

testCaseSchema.index({ project: 1, run: 1 });
testCaseSchema.index({ project: 1, testKey: 1, createdAt: -1 });
testCaseSchema.index({ project: 1, status: 1 });
testCaseSchema.index({ project: 1, durationMs: -1 });

export default mongoose.model<ITestCase>('TestCase', testCaseSchema);
