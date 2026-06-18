import express, { Request, Response } from 'express';
import TestRun from '../models/TestRun';
import TestHistory from '../models/TestHistory';
import { apiKeyAuth } from '../middleware/auth';

const router = express.Router();

router.get('/trends', apiKeyAuth, async (req: Request, res: Response) => {
  const days = Math.min(parseInt(req.query.days as string) || 30, 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const filter: Record<string, unknown> = {
    project: req.project._id,
    createdAt: { $gte: since },
    status: { $ne: 'in_progress' },
  };
  if (req.query.jobName) filter.jobName = req.query.jobName as string;

  const runs = await TestRun.aggregate([
    { $match: filter },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        runs: { $sum: 1 },
        avgPassRate: { $avg: '$summary.passRate' },
        totalTests: { $sum: '$summary.total' },
        failed: { $sum: '$summary.failed' },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        date: '$_id',
        _id: 0,
        runs: 1,
        avgPassRate: { $round: ['$avgPassRate', 2] },
        totalTests: 1,
        failed: 1,
      },
    },
  ]);

  res.json(runs);
});

router.get('/flaky', apiKeyAuth, async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

  const tests = await TestHistory.find({
    project: req.project._id,
    flakeScore: { $gt: 0 },
    totalRuns: { $gte: 3 },
  })
    .sort({ flakeScore: -1 })
    .limit(limit)
    .select('testKey suiteName testName flakeScore totalRuns passed failed lastStatuses lastStatus lastRunAt');

  res.json(tests);
});

router.get('/slowest', apiKeyAuth, async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

  const tests = await TestHistory.find({ project: req.project._id, totalRuns: { $gte: 1 } })
    .sort({ avgDurationMs: -1 })
    .limit(limit)
    .select('testKey suiteName testName avgDurationMs totalRuns lastStatus');

  res.json(tests);
});

router.get('/failing', apiKeyAuth, async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

  const tests = await TestHistory.find({ project: req.project._id, failed: { $gt: 0 } })
    .sort({ failed: -1 })
    .limit(limit)
    .select('testKey suiteName testName failed passed totalRuns lastStatus lastRunAt');

  res.json(tests);
});

router.get('/summary', apiKeyAuth, async (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [runStats, testStats] = await Promise.all([
    TestRun.aggregate([
      {
        $match: {
          project: req.project._id,
          createdAt: { $gte: since },
          status: { $ne: 'in_progress' },
        },
      },
      {
        $group: {
          _id: null,
          totalRuns: { $sum: 1 },
          passedRuns: { $sum: { $cond: [{ $eq: ['$status', 'passed'] }, 1, 0] } },
          failedRuns: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
          avgPassRate: { $avg: '$summary.passRate' },
          totalTests: { $sum: '$summary.total' },
          avgDurationMs: { $avg: '$summary.durationMs' },
        },
      },
    ]),
    TestHistory.aggregate([
      { $match: { project: req.project._id } },
      {
        $group: {
          _id: null,
          uniqueTests: { $sum: 1 },
          flakyTests: { $sum: { $cond: [{ $gt: ['$flakeScore', 0.2] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const run = (runStats[0] || {}) as Record<string, number>;
  const test = (testStats[0] || {}) as Record<string, number>;

  res.json({
    period: `${days}d`,
    runs: {
      total: run.totalRuns || 0,
      passed: run.passedRuns || 0,
      failed: run.failedRuns || 0,
      avgPassRate: run.avgPassRate ? parseFloat(run.avgPassRate.toFixed(2)) : 0,
      avgDurationMs: run.avgDurationMs ? Math.round(run.avgDurationMs) : 0,
      totalTestsExecuted: run.totalTests || 0,
    },
    tests: {
      unique: test.uniqueTests || 0,
      flaky: test.flakyTests || 0,
    },
  });
});

router.get('/jobs', apiKeyAuth, async (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const jobs = await TestRun.aggregate([
    {
      $match: {
        project: req.project._id,
        createdAt: { $gte: since },
        status: { $ne: 'in_progress' },
      },
    },
    {
      $group: {
        _id: '$jobName',
        runs: { $sum: 1 },
        passed: { $sum: { $cond: [{ $eq: ['$status', 'passed'] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        avgPassRate: { $avg: '$summary.passRate' },
        lastRun: { $max: '$createdAt' },
      },
    },
    { $sort: { runs: -1 } },
    {
      $project: {
        jobName: '$_id',
        _id: 0,
        runs: 1,
        passed: 1,
        failed: 1,
        avgPassRate: { $round: ['$avgPassRate', 2] },
        lastRun: 1,
      },
    },
  ]);

  res.json(jobs);
});

export default router;
