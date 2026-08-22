import { Request, Response } from 'express';
import {
  createComment,
  deleteComment,
  getComments,
  PaginationParams,
} from '@/service/comment.service';

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
      case 'COMMENT_EMPTY':
        return res.status(400).json({ success: false, message: 'Comment cannot be empty' });
      case 'COMMENT_TOO_LONG':
        return res.status(400).json({ success: false, message: 'Comment too long (max 2000 characters)' });
      case 'COMMENT_NOT_FOUND':
        return res.status(404).json({ success: false, message: 'Comment not found' });
      case 'NOT_OWNER':
        return res.status(403).json({ success: false, message: 'You are not allowed to perform this action' });
    }
  }
  console.error('Comment error:', error);
  return res.status(500).json({ success: false, message: 'Internal server error' });
};

export const createCommentController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const photoId = Array.isArray(req.params.photoId) ? req.params.photoId[0] : req.params.photoId;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Comment text is required' });
    }

    const comment = await createComment({
      photoId,
      userId: req.user.userId,
      text: text.trim(),
    });

    return res.status(201).json({
      success: true,
      message: 'Comment created successfully',
      data: comment,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const getCommentsController = async (req: AuthRequest, res: Response) => {
  try {
    const photoId = Array.isArray(req.params.photoId) ? req.params.photoId[0] : req.params.photoId;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    const result = await getComments(photoId, { page, limit });

    return res.status(200).json({
      success: true,
      message: 'Comments retrieved successfully',
      data: result,
    });
  } catch (error) {
    console.error('Get comments error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteCommentController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const commentId = Array.isArray(req.params.commentId) ? req.params.commentId[0] : req.params.commentId;

    await deleteComment(commentId, req.user.userId);

    return res.status(200).json({
      success: true,
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    return handleError(res, error);
  }
};