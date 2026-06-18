import express, { Request, Response } from 'express';
import Project from '../models/Project';
import { adminAuth } from '../middleware/auth';

const router = express.Router();

router.post('/', adminAuth, async (req: Request, res: Response) => {
// router.post('/', async (req: Request, res: Response) => {

  const { name, description } = req.body as { name?: string; description?: string };
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const { key, hash } = Project.generateApiKey();

  const project = await Project.create({ name, description, apiKey: key, apiKeyHash: hash });

  res.status(201).json({
    message: 'Project created. Save the apiKey — it will not be shown again.',
    apiKey: key,
    project: { _id: project._id, name: project.name, description: project.description },
  });
});

router.get('/', adminAuth, async (_req: Request, res: Response) => {
// router.get('/', async (_req: Request, res: Response) => {

const projects = await Project.find().select('-apiKey -apiKeyHash').sort({ createdAt: -1 });
  res.json(projects);
});

router.delete('/:id', adminAuth, async (req: Request, res: Response) => {
  const project = await Project.findByIdAndUpdate(
    req.params.id,
    { active: false },
    { new: true }
  );
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  res.json({ message: 'Project deactivated' });
});

export default router;
