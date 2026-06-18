import { Types } from 'mongoose';
import TestHistory from '../models/TestHistory';

const ROLLING_WINDOW = 20;

export interface TestCaseForHistory {
  testKey: string;
  suiteName: string;
  testName: string;
  status: string;
  durationMs: number;
}

function computeFlakeScore(statuses: string[]): number {
  if (statuses.length < 2) return 0;
  let alternations = 0;
  for (let i = 1; i < statuses.length; i++) {
    const prev = statuses[i - 1] === 'passed' ? 'pass' : 'fail';
    const curr = statuses[i] === 'passed' ? 'pass' : 'fail';
    if (prev !== curr) alternations++;
  }
  return parseFloat((alternations / (statuses.length - 1)).toFixed(4));
}

export async function updateHistory(
  projectId: Types.ObjectId | string,
  testCases: TestCaseForHistory[],
  runDate: Date
): Promise<void> {
  const ops = testCases.map((tc) => ({
    updateOne: {
      filter: { project: projectId, testKey: tc.testKey },
      update: {
        $inc: {
          totalRuns: 1,
          passed: tc.status === 'passed' ? 1 : 0,
          failed: tc.status === 'failed' || tc.status === 'error' ? 1 : 0,
          skipped: tc.status === 'skipped' ? 1 : 0,
        },
        $set: {
          suiteName: tc.suiteName,
          testName: tc.testName,
          lastStatus: tc.status,
          lastRunAt: runDate || new Date(),
        },
        $push: {
          lastStatuses: {
            $each: [tc.status],
            $slice: -ROLLING_WINDOW,
          },
        },
      },
      upsert: true,
    },
  }));

  await TestHistory.bulkWrite(ops);

  const keys = testCases.map((tc) => tc.testKey);
  const histories = await TestHistory.find({ project: projectId, testKey: { $in: keys } });

  const scoreOps = histories.map((h) => {
    const flakeScore = computeFlakeScore(h.lastStatuses);
    const prevTotal = h.totalRuns - 1;
    const avgDurationMs =
      prevTotal > 0
        ? Math.round(
            (h.avgDurationMs * prevTotal +
              (testCases.find((tc) => tc.testKey === h.testKey)?.durationMs || 0)) /
              h.totalRuns
          )
        : testCases.find((tc) => tc.testKey === h.testKey)?.durationMs || 0;

    return {
      updateOne: {
        filter: { _id: h._id },
        update: { $set: { flakeScore, avgDurationMs } },
      },
    };
  });

  if (scoreOps.length) await TestHistory.bulkWrite(scoreOps);
}
