import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { initDb, db } from './db.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import issueRoutes from './routes/issues.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Security & middleware
app.use(helmet());
app.use(cors({ origin: '*', credentials: false }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', apiLimiter);

// Healthcheck
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/issues', issueRoutes);

// Start server after DB init
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`SIH server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database', err);
    process.exit(1);
  });

