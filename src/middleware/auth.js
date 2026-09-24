import { requireUser } from './requireUser.js';

export function adminAuth(req, res, next) {
  return requireUser(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Administrator access required.',
      });
    }

    return next();
  });
}