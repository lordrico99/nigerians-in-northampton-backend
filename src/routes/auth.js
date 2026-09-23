import { Router } from 'express';
import User from '../models/User.js';
import {
  clearSessionCookie,
  createUserSession,
  getSessionTokenFromRequest,
  hashPassword,
  revokeCurrentSession,
  setSessionCookie,
  verifyPassword,
} from '../utils/auth.js';
import { requireUser } from '../middleware/requireUser.js';

const router = Router();

function publicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post('/register', async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (name.length < 2 || name.length > 120) {
      return res.status(400).json({
        success: false,
        message: 'Please enter your full name.',
      });
    }

    if (!validEmail(email) || email.length > 160) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.',
      });
    }

    if (password.length < 8 || password.length > 200) {
      return res.status(400).json({
        success: false,
        message: 'Your password must be between 8 and 200 characters.',
      });
    }

    const existingUser = await User.findOne({ email }).lean();

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists. Try signing in instead.',
      });
    }

    const user = await User.create({
      name,
      email,
      passwordHash: await hashPassword(password),
    });

    const token = await createUserSession(user._id, false);
    setSessionCookie(res, token, false);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      user: publicUser(user),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const remember = Boolean(req.body?.remember);

    if (!validEmail(email) || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please enter your email address and password.',
      });
    }

    const user = await User.findOne({ email }).select('+passwordHash');

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({
        success: false,
        message: 'The email address or password is incorrect.',
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'This account is not currently active.',
      });
    }

    await revokeCurrentSession(req);

    const token = await createUserSession(user._id, remember);
    setSessionCookie(res, token, remember);

    return res.json({
      success: true,
      message: 'Signed in successfully.',
      user: publicUser(user),
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', requireUser, async (req, res) => {
  return res.json({
    success: true,
    user: publicUser(req.user),
  });
});

router.post('/logout', async (req, res, next) => {
  try {
    await revokeCurrentSession(req);
    clearSessionCookie(res);

    return res.json({
      success: true,
      message: 'Signed out successfully.',
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
