import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import {
  registerController,
  loginController,
  refreshController,
  logoutController,
  logoutAllController,
  meController,
} from '@/controller/auth.controller';
import { authMiddleware } from '@/middleware/auth.middleware';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts, please try again later.',
    });
  },
});

router.post('/register', authLimiter, registerController);
router.post('/login', authLimiter, loginController);
router.post('/refresh', authLimiter, refreshController);

router.post('/logout', authMiddleware, logoutController);
router.post('/logout-all', authMiddleware, logoutAllController);
router.get('/me', authMiddleware, meController);

export default router;