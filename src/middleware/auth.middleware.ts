import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AccessTokenPayload } from '@/config/auth.config';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    sessionId: string;
    username: string;
  };
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      userId: payload.sub,
      sessionId: payload.sessionId,
      username: payload.username,
    };
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }
}

export function optionalAuthMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      userId: payload.sub,
      sessionId: payload.sessionId,
      username: payload.username,
    };
  } catch {
    // Ignore invalid tokens for optional auth
  }

  next();
}