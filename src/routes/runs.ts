import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import TestRun from '../models/TestRun';
import TestCase from '../models/TestCase';
import { apiKeyAuth } from '../middleware/auth';
import { parseJUnit, TestCaseResult } from '../services/junitParser';
import { updateHistory } from '../services/testHistoryService';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req: Request, _file, cb) => {
    const dir = path.join('uploads', req.run._id.toString());
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

async function attachRun(req: Request, res: Response, next: NextFunction): Promise<void> {
  const run = await TestRun.findOne({ _id: req.params.runId, project: req.project._id });
  if (!run) {
    res.status(404).json({ error: 'Test run not found' });
    return;
  }
  req.run = run;
  next();
}

router.post('/', apiKeyAuth, async (req: Request, res: Response) => {
  const body = req.body as {
    jobName?: string;
    buildNumber?: string | number;
    branch?: string;
    commitHash?: string;
    triggeredBy?: string;
    jenkinsUrl?: string;
    startedAt?: string;
  };
  const { jobName, buildNumber, branch, commitHash, triggeredBy, jenkinsUrl, startedAt } = body;

  if (!jobName) {
    res.status(400).json({ error: 'jobName is required' });
    return;
  }
  if (buildNumber === undefined) {
    res.status(400).json({ error: 'buildNumber is required' });
    return;
  }

  const existing = await TestRun.findOne({
    project: req.project._id,
    jobName,
    buildNumber: Number(buildNumber),
  });
  if (existing) {
    res.status(409).json({ error: 'Run already exists', runId: existing._id });
    return;
  }

  const run = await TestRun.create({
    project: req.project._id,
    jobName,
    buildNumber: Number(buildNumber),
    branch: branch ?? 'unknown',
    commitHash: commitHash ?? '',
    triggeredBy: triggeredBy ?? '',
    jenkinsUrl: jenkinsUrl ?? '',
    startedAt: startedAt ? new Date(startedAt) : new Date(),
    status: 'in_progress',
  });

  res.status(201).json({ runId: run._id });
});

router.post('/:runId/results', apiKeyAuth, attachRun, async (req: Request, res: Response) => {
  if (req.run.status !== 'in_progress') {
    res.status(400).json({ error: 'Run is already finished' });
    return;
  }

  let testCases: TestCaseResult[] = [];
  const contentType = req.headers['content-type'] || '';

  if (contentType.includes('xml')) {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    await new Promise<void>((resolve, reject) => {
      req.on('end', resolve);
      req.on('error', reject);
    });
    const xml = Buffer.concat(chunks).toString('utf-8');
    testCases = await parseJUnit(xml);
  } else {
    const body = req.body as unknown;
    if (!Array.isArray(body)) {
      res.status(400).json({ error: 'Expected JSON array of test cases' });
      return;
    }
    testCases = (body as Record<string, unknown>[]).map((tc) => ({
      suiteName: (tc.suiteName as string) || 'Unknown Suite',
      testName: (tc.testName as string) || 'Unknown Test',
      testKey: `${tc.suiteName || 'Unknown Suite'}::${tc.testName || 'Unknown Test'}`,
      status: ((tc.status as string) || 'passed') as TestCaseResult['status'],
      durationMs: (tc.durationMs as number) || 0,
      errorMessage: (tc.errorMessage as string) || '',
      stackTrace: (tc.stackTrace as string) || '',
      stdOut: (tc.stdOut as string) || '',
      stdErr: (tc.stdErr as string) || '',
    }));
  }

  if (!testCases.length) {
    res.status(400).json({ error: 'No test cases found in payload' });
    return;
  }

  const docs = testCases.map((tc) => ({ ...tc, project: req.project._id, run: req.run._id }));
  await TestCase.insertMany(docs);

  res.json({ inserted: testCases.length });
});

router.post(
  '/:runId/artifacts',
  apiKeyAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    const run = await TestRun.findOne({ _id: req.params.runId, project: req.project._id });
    if (!run) {
      res.status(404).json({ error: 'Test run not found' });
      return;
    }
    req.run = run;
    next();
  },
  upload.array('files', 20),
  async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[];
    if (!files?.length) {
      res.status(400).json({ error: 'No files uploaded' });
      return;
    }

    const artifacts = files.map((f) => ({ name: f.originalname, path: f.path, size: f.size }));
    await TestRun.findByIdAndUpdate(req.run._id, { $push: { artifacts: { $each: artifacts } } });

    res.json({ uploaded: artifacts.length, files: artifacts.map((a) => a.name) });
  }
);

router.patch('/:runId/finish', apiKeyAuth, attachRun, async (req: Request, res: Response) => {
  if (req.run.status !== 'in_progress') {
    res.status(400).json({ error: 'Run already finished' });
    return;
  }

  const aggregateResult = await TestCase.aggregate([
    { $match: { run: req.run._id } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        passed: { $sum: { $cond: [{ $eq: ['$status', 'passed'] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $in: ['$status', ['failed', 'error']] }, 1, 0] } },
        skipped: { $sum: { $cond: [{ $eq: ['$status', 'skipped'] }, 1, 0] } },
        durationMs: { $sum: '$durationMs' },
      },
    },
  ]);

  const counts = aggregateResult[0] as {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    durationMs: number;
    passRate?: number;
  } | undefined;

  const summary = counts || { total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0 };
  summary.passRate =
    summary.total > 0 ? parseFloat(((summary.passed / summary.total) * 100).toFixed(2)) : 0;

  const bodyStatus = (req.body as Record<string, string>).status;
  const overallStatus =
    bodyStatus ||
    (summary.failed > 0 ? 'failed' : summary.total === 0 ? 'aborted' : 'passed');

  const bodyFinishedAt = (req.body as Record<string, string>).finishedAt;
  const finishedAt = bodyFinishedAt ? new Date(bodyFinishedAt) : new Date();

  const run = await TestRun.findByIdAndUpdate(
    req.run._id,
    { status: overallStatus, summary, finishedAt },
    { new: true }
  );

  const testCases = await TestCase.find({ run: req.run._id }).lean();
  updateHistory(req.project._id, testCases, finishedAt).catch(console.error);

  res.json({ run });
});

router.get('/', apiKeyAuth, async (req: Request, res: Response) => {
  const { jobName, status, page = '1', limit = '20' } = req.query as Record<string, string>;
  const filter: Record<string, unknown> = { project: req.project._id };
  if (jobName) filter.jobName = jobName;
  if (status) filter.status = status;

  const [runs, total] = await Promise.all([
    TestRun.find(filter)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .select('-artifacts'),
    TestRun.countDocuments(filter),
  ]);

  res.json({ runs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

router.get('/:runId', apiKeyAuth, attachRun, async (req: Request, res: Response) => {
  const testCases = await TestCase.find({ run: req.run._id }).sort({ status: 1, testName: 1 });
  res.json({ run: req.run, testCases });
});

export default router;
