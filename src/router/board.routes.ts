import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import {
  createBoardController,
  getBoardsController,
  getBoardController,
  renameBoardController,
  deleteBoardController,
  savePhotoToBoardController,
  removePhotoFromBoardController,
  getBoardPhotosController,
  getUserBoardsForPhotoController,
} from '@/controller/board.controller';
import { authMiddleware, optionalAuthMiddleware } from '@/middleware/auth.middleware';

const router = Router();

const boardCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      message: 'Too many board creation attempts, please try again later.',
    });
  },
});

const saveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      message: 'Too many save requests, please try again later.',
    });
  },
});

router.post('/', authMiddleware, boardCreateLimiter, createBoardController);
router.get('/user/:userId', optionalAuthMiddleware, getBoardsController);
router.get('/:boardId', optionalAuthMiddleware, getBoardController);
router.patch('/:boardId', authMiddleware, renameBoardController);
router.delete('/:boardId', authMiddleware, deleteBoardController);
router.post('/:boardId/photos/:photoId', authMiddleware, saveLimiter, savePhotoToBoardController);
router.delete('/:boardId/photos/:photoId', authMiddleware, removePhotoFromBoardController);
router.get('/:boardId/photos', optionalAuthMiddleware, getBoardPhotosController);
router.get('/photo/:photoId/user-boards', authMiddleware, getUserBoardsForPhotoController);

export default router;