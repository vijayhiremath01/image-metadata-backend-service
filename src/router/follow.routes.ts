import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import {
  followUserController,
  unfollowUserController,
  getFollowersController,
  getFollowingController,
  getFollowStatusController,
} from '@/controller/follow.controller';
import { authMiddleware, optionalAuthMiddleware } from '@/middleware/auth.middleware';

const router = Router();

const followLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      message: 'Too many follow requests, please try again later.',
    });
  },
});

router.post('/:userId/follow', authMiddleware, followLimiter, followUserController);
router.delete('/:userId/follow', authMiddleware, followLimiter, unfollowUserController);
router.get('/:userId/followers', optionalAuthMiddleware, getFollowersController);
router.get('/:userId/following', optionalAuthMiddleware, getFollowingController);
router.get('/:userId/follow/status', authMiddleware, getFollowStatusController);

export default router;