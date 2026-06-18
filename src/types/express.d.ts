import { IProject } from '../models/Project';
import { ITestRun } from '../models/TestRun';

declare global {
  namespace Express {
    interface Request {
      project: IProject;
      run: ITestRun;
    }
  }
}
