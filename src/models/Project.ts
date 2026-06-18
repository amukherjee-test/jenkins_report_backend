import mongoose, { Document, Model } from 'mongoose';
import crypto from 'crypto';

export interface IProject extends Document {
  name: string;
  description: string;
  apiKey: string;
  apiKeyHash: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface IProjectModel extends Model<IProject> {
  generateApiKey(): { key: string; hash: string };
  hashKey(key: string): string;
}

const projectSchema = new mongoose.Schema<IProject, IProjectModel>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: '' },
    apiKey: { type: String, required: true, unique: true },
    apiKeyHash: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

projectSchema.index({ apiKeyHash: 1 });

projectSchema.statics.generateApiKey = function (): { key: string; hash: string } {
  const key = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  return { key, hash };
};

projectSchema.statics.hashKey = function (key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
};

projectSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.apiKey;
  delete obj.apiKeyHash;
  return obj;
};

export default mongoose.model<IProject, IProjectModel>('Project', projectSchema);
