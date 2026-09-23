import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import { env } from './config/env.js';
import { connectDatabase } from './config/db.js';
import { adminAuth } from './middleware/auth.js';
import { notFound, errorHandler } from './middleware/error.js';
import { publicRouter } from './routes/public.js';
import { submissionRouter } from './routes/submissions.js';
import { adminRouter } from './routes/admin.js';
import authRouter from './routes/auth.js';

const app = express();

fs.mkdirSync(env.uploadDir, { recursive: true });

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

const corsOptions = {
  origin(origin, callback) {
    // Requests such as direct browser navigation or health checks
    // may not contain an Origin header.
    if (!origin) {
      return callback(null, true);
    }

    // Explicitly configured frontend origins.
    if (env.frontendOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow local development from localhost / 127.0.0.1
    // regardless of which Live Server port is being used.
    try {
      const url = new URL(origin);

      const isLocalDevelopment =
        url.protocol === 'http:' &&
        (url.hostname === 'localhost' ||
          url.hostname === '127.0.0.1');

      if (isLocalDevelopment) {
        return callback(null, true);
      }
    } catch {
      // Invalid Origin header.
    }

    return callback(
      new Error(`CORS blocked origin: ${origin}`)
    );
  },

  methods: [
    'GET',
    'POST',
    'PATCH',
    'PUT',
    'DELETE',
    'OPTIONS'
  ],

  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Admin-Api-Key',
    'X-Api-Key'
  ],

  credentials: true,

  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    service: 'nin-directory-backend',
    status: 'ok',
    environment: env.nodeEnv,
  });
});

app.use('/uploads/businesses', express.static(env.uploadDir, {
  maxAge: env.nodeEnv === 'production' ? '7d' : 0,
  fallthrough: false,
}));

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many submission attempts. Please try again later.' },
});

app.use('/api/businesses', publicLimiter, publicRouter);
app.use('/api/business-submissions', submissionLimiter, submissionRouter);
app.use('/api/auth', authRouter);
app.use('/api', adminAuth, adminRouter);

app.use(notFound);
app.use(errorHandler);

async function start() {
  await connectDatabase();

  app.listen(env.port, "0.0.0.0", () => {
  console.log(
    `NIN Directory API running on 0.0.0.0:${env.port}`
  );
});
}

start().catch((error) => {
  console.error('Failed to start backend:', error.message);
  process.exit(1);
});
