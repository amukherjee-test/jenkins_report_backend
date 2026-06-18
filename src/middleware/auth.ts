import { Request, Response, NextFunction } from 'express';
import Project from '../models/Project';

export async function apiKeyAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const key = req.headers['x-api-key'] as string | undefined;
  if (!key) {
    res.status(401).json({ error: 'Missing X-API-Key header' });
    return;
  }

  const hash = Project.hashKey(key);
  const project = await Project.findOne({ apiKeyHash: hash, active: true });
  if (!project) {
    res.status(401).json({ error: 'Invalid or inactive API key' });
    return;
  }

  req.project = project;
  next();
}

export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = req.headers['x-admin-secret'] as string | undefined;
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    res.status(401).json({ error: 'Invalid admin secret' });
    return;
  }
  next();
}
