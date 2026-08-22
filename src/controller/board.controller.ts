import { Request, Response } from 'express';
import {
  createBoard,
  renameBoard,
  deleteBoard,
  savePhotoToBoard,
  removePhotoFromBoard,
  getBoards,
  getBoardById,
  getBoardPhotos,
  getUserBoardsWithPhoto,
  PaginationParams,
} from '@/service/board.service';

type AuthRequest = Request & {
  user?: {
    userId: string;
    sessionId: string;
    username: string;
  };
};

const handleError = (res: Response, error: unknown) => {
  if (error instanceof Error) {
    switch (error.message) {
      case 'BOARD_NAME_TOO_LONG':
        return res.status(400).json({ success: false, message: 'Board name too long (max 255 characters)' });
      case 'BOARD_NOT_FOUND':
        return res.status(404).json({ success: false, message: 'Board not found' });
      case 'PHOTO_NOT_FOUND':
        return res.status(404).json({ success: false, message: 'Photo not found' });
      case 'PHOTO_NOT_IN_BOARD':
        return res.status(404).json({ success: false, message: 'Photo not in board' });
    }
  }
  console.error('Board error:', error);
  return res.status(500).json({ success: false, message: 'Internal server error' });
};

export const createBoardController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { name, description, isPrivate } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Board name is required' });
    }

    const board = await createBoard({
      userId: req.user.userId,
      name: name.trim(),
      description: description?.trim() || '',
      isPrivate: isPrivate ?? false,
    });

    return res.status(201).json({
      success: true,
      message: 'Board created successfully',
      data: board,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const getBoardsController = async (req: AuthRequest, res: Response) => {
  try {
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const currentUserId = req.user?.userId;

    const result = await getBoards(userId, { page, limit }, currentUserId);

    return res.status(200).json({
      success: true,
      message: 'Boards retrieved successfully',
      data: result,
    });
  } catch (error) {
    console.error('Get boards error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getBoardController = async (req: AuthRequest, res: Response) => {
  try {
    const boardId = Array.isArray(req.params.boardId) ? req.params.boardId[0] : req.params.boardId;
    const currentUserId = req.user?.userId;

    const board = await getBoardById(boardId, currentUserId);

    if (!board) {
      return res.status(404).json({ success: false, message: 'Board not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Board retrieved successfully',
      data: board,
    });
  } catch (error) {
    console.error('Get board error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const renameBoardController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const boardId = Array.isArray(req.params.boardId) ? req.params.boardId[0] : req.params.boardId;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Board name is required' });
    }

    const board = await renameBoard(boardId, req.user.userId, name.trim());

    return res.status(200).json({
      success: true,
      message: 'Board renamed successfully',
      data: board,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const deleteBoardController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const boardId = Array.isArray(req.params.boardId) ? req.params.boardId[0] : req.params.boardId;

    await deleteBoard(boardId, req.user.userId);

    return res.status(200).json({
      success: true,
      message: 'Board deleted successfully',
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const savePhotoToBoardController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const boardId = Array.isArray(req.params.boardId) ? req.params.boardId[0] : req.params.boardId;
    const photoId = Array.isArray(req.params.photoId) ? req.params.photoId[0] : req.params.photoId;

    await savePhotoToBoard(boardId, photoId, req.user.userId);

    return res.status(200).json({
      success: true,
      message: 'Photo saved to board successfully',
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const removePhotoFromBoardController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const boardId = Array.isArray(req.params.boardId) ? req.params.boardId[0] : req.params.boardId;
    const photoId = Array.isArray(req.params.photoId) ? req.params.photoId[0] : req.params.photoId;

    await removePhotoFromBoard(boardId, photoId, req.user.userId);

    return res.status(200).json({
      success: true,
      message: 'Photo removed from board successfully',
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const getBoardPhotosController = async (req: AuthRequest, res: Response) => {
  try {
    const boardId = Array.isArray(req.params.boardId) ? req.params.boardId[0] : req.params.boardId;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const currentUserId = req.user?.userId;

    const result = await getBoardPhotos(boardId, { page, limit }, currentUserId);

    return res.status(200).json({
      success: true,
      message: 'Board photos retrieved successfully',
      data: result,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const getUserBoardsForPhotoController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const photoId = Array.isArray(req.params.photoId) ? req.params.photoId[0] : req.params.photoId;

    const boards = await getUserBoardsWithPhoto(req.user.userId, photoId);

    return res.status(200).json({
      success: true,
      message: 'User boards retrieved successfully',
      data: boards,
    });
  } catch (error) {
    console.error('Get user boards for photo error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};