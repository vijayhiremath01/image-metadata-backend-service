import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { getMeController, getMyPhotosController, deleteAccountController } from '@/controller/user.controller';
import { authMiddleware } from '@/middleware/auth.middleware';

const router = Router();

const deleteAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      message: 'Too many account deletion attempts, please try again later.',
    });
  },
});

router.get('/me', authMiddleware, getMeController);
router.get('/me/photos', authMiddleware, getMyPhotosController);
router.delete('/me', authMiddleware, deleteAccountLimiter, deleteAccountController);

export default router;