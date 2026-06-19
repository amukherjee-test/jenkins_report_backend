import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import connectDB from './config/db';

import projectsRouter from './routes/projects';
import runsRouter from './routes/runs';
import analyticsRouter from './routes/analytics';

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));

// Parse JSON for most routes — XML is read as raw stream in the results route
app.use((req: Request, res: Response, next: NextFunction) => {
  const ct = req.headers['content-type'] || '';
  if (ct.includes('xml')) return next();
  express.json({ limit: '10mb' })(req, res, next);
});

app.get('/health', (_req: Request, res: Response) =>
  res.json({ status: 'ok', ts: new Date().toISOString() })
);

app.use('/api/projects', projectsRouter);
app.use('/api/runs', runsRouter);
app.use('/api/analytics', analyticsRouter);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// MongoDB is optional — connect in the background; routes that need it will fail gracefully if it's down
connectDB().catch((err: Error) => console.error('MongoDB connection failed:', err));
