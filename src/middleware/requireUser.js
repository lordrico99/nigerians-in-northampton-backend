import UserSession from '../models/UserSession.js';
import { getSessionTokenFromRequest, hashSessionToken } from '../utils/auth.js';

export async function requireUser(req, res, next) {
  try {
    const token = getSessionTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    const session = await UserSession.findOne({
      tokenHash: hashSessionToken(token),
      expiresAt: { $gt: new Date() },
    }).populate('userId');

    if (!session || !session.userId) {
      return res.status(401).json({
        success: false,
        message: 'Your session has expired. Please sign in again.',
      });
    }

    if (session.userId.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'This account is not currently active.',
      });
    }

    req.user = session.userId;
    req.userSession = session;

    return next();
  } catch (error) {
    return next(error);
  }
}
