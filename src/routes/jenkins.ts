import express, { Request, Response } from 'express';
import { fetchAndStore } from '../services/jenkinsFetcher';

const router = express.Router();

// POST /api/jenkins/fetch
// Body: { jobName: string, buildNumber: number }
router.post('/fetch', async (req: Request, res: Response) => {
  const { jobName, buildNumber } = req.body as { jobName?: string; buildNumber?: number };

  if (!jobName) {
    res.status(400).json({ error: 'jobName is required' });
    return;
  }
  if (buildNumber === undefined) {
    res.status(400).json({ error: 'buildNumber is required' });
    return;
  }

  const dir = await fetchAndStore(jobName, buildNumber);
  res.json({ message: 'Stored', path: dir });
});

export default router;
