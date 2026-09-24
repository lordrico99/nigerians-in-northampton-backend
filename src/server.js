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
import { memberRouter } from './routes/member.js';
import authRouter from './routes/auth.js';

const app = express();

/*
  ============================================================
  BASIC APP SETUP
  ============================================================
*/

fs.mkdirSync(env.uploadDir, {
  recursive: true,
});

app.disable('x-powered-by');

app.set('trust proxy', 1);


/*
  ============================================================
  SECURITY HEADERS
  ============================================================
*/

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
  })
);


/*
  ============================================================
  CORS
  ============================================================
*/

const corsOptions = {
  origin(origin, callback) {
    /*
      Requests such as direct browser navigation or
      server-to-server health checks may not contain
      an Origin header.
    */
    if (!origin) {
      return callback(null, true);
    }

    /*
      Explicitly configured frontend origins.
    */
    if (env.frontendOrigins.includes(origin)) {
      return callback(null, true);
    }

    /*
      Allow local development from localhost / 127.0.0.1
      regardless of the Live Server port.
    */
    try {
      const url = new URL(origin);

      const isLocalDevelopment =
        url.protocol === 'http:' &&
        (
          url.hostname === 'localhost' ||
          url.hostname === '127.0.0.1'
        );

      if (isLocalDevelopment) {
        return callback(null, true);
      }
    } catch {
      /*
        Invalid Origin header.
      */
    }

    return callback(
      new Error(
        `CORS blocked origin: ${origin}`
      )
    );
  },

  methods: [
    'GET',
    'POST',
    'PATCH',
    'PUT',
    'DELETE',
    'OPTIONS',
  ],

  /*
    These include the headers currently used
    by the admin dashboard.
  */
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Admin-Api-Key',
    'X-Api-Key',
  ],

  credentials: true,

  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));


/*
  ============================================================
  REQUEST PARSING
  ============================================================
*/

app.use(
  express.json({
    limit: '1mb',
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '1mb',
  })
);


/*
  ============================================================
  HEALTH CHECK
  ============================================================
*/

app.get('/api/health', (_req, res) => {
  return res.json({
    success: true,
    service: 'nin-directory-backend',
    status: 'ok',
    environment: env.nodeEnv,
  });
});


/*
  ============================================================
  STATIC BUSINESS UPLOADS
  ============================================================
*/

app.use(
  '/uploads/businesses',
  express.static(env.uploadDir, {
    maxAge:
      env.nodeEnv === 'production'
        ? '7d'
        : 0,

    fallthrough: false,
  })
);


/*
  ============================================================
  RATE LIMITERS
  ============================================================
*/

const publicLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit: 300,

    standardHeaders: 'draft-8',

    legacyHeaders: false,
  });


const submissionLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit: 10,

    standardHeaders: 'draft-8',

    legacyHeaders: false,

    message: {
      success: false,
      message:
        'Too many submission attempts. Please try again later.',
    },
  });


/*
  ============================================================
  ROUTES
  ============================================================
*/

/*
  PUBLIC DIRECTORY

  GET /api/businesses
  etc.
*/
app.use(
  '/api/businesses',
  publicLimiter,
  publicRouter
);


/*
  NEW BUSINESS SUBMISSION

  POST /api/business-submissions

  This router already uses requireUser internally.
*/
app.use(
  '/api/business-submissions',
  submissionLimiter,
  submissionRouter
);


/*
  MEMBER ACCOUNT AUTHENTICATION

  /api/auth/register
  /api/auth/login
  /api/auth/me
  /api/auth/logout
*/
app.use(
  '/api/auth',
  authRouter
);


/*
  MEMBER BUSINESS MANAGEMENT

  IMPORTANT:
  This must come BEFORE the global adminAuth route.

  The member router performs requireUser on its
  protected routes, while allowing ordinary
  authenticated members to access them.

  Examples:

  GET
    /api/my/businesses

  POST
    /api/business-submissions/:reference/resubmit

  POST
    /api/business-submissions/:reference/withdraw

  POST
    /api/businesses/:id/change-requests

  POST
    /api/businesses/:id/removal-request
*/
app.use(
  '/api',
  memberRouter
);


/*
  ADMIN ROUTES

  Everything inside adminRouter is protected by
  adminAuth.

  adminAuth:
    1. verifies the session
    2. verifies req.user.role === 'admin'
*/
app.use(
  '/api',
  adminAuth,
  adminRouter
);


/*
  ============================================================
  ERROR HANDLING
  ============================================================
*/

app.use(notFound);

app.use(errorHandler);


/*
  ============================================================
  START SERVER
  ============================================================
*/

async function start() {
  await connectDatabase();

  app.listen(
    env.port,
    '0.0.0.0',
    () => {
      console.log(
        `NIN Directory API running on 0.0.0.0:${env.port}`
      );
    }
  );
}

start().catch((error) => {
  console.error(
    'Failed to start backend:',
    error.message
  );

  process.exit(1);
});