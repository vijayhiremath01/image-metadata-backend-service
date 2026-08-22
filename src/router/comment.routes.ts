import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import {
  createCommentController,
  getCommentsController,
  deleteCommentController,
} from '@/controller/comment.controller';
import { authMiddleware, optionalAuthMiddleware } from '@/middleware/auth.middleware';

const router = Router();

const commentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      message: 'Too many comment requests, please try again later.',
    });
  },
});

router.get('/:photoId/comments', optionalAuthMiddleware, getCommentsController);
router.post('/:photoId/comments', authMiddleware, commentLimiter, createCommentController);
router.delete('/comments/:commentId', authMiddleware, deleteCommentController);

export default router;