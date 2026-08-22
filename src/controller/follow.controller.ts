import { Request, Response } from 'express';
import {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  isFollowing,
  getFollowCounts,
  PaginationParams,
} from '@/service/follow.service';

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
      case 'CANNOT_FOLLOW_SELF':
        return res.status(400).json({ success: false, message: 'Cannot follow yourself' });
      case 'USER_NOT_FOUND':
        return res.status(404).json({ success: false, message: 'User not found' });
      case 'NOT_FOLLOWING':
        return res.status(409).json({ success: false, message: 'Not following this user' });
    }
  }
  console.error('Follow error:', error);
  return res.status(500).json({ success: false, message: 'Internal server error' });
};

export const followUserController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;

    if (req.user.userId === userId) {
      return res.status(400).json({ success: false, message: 'Cannot follow yourself' });
    }

    await followUser(req.user.userId, userId);

    return res.status(200).json({
      success: true,
      message: 'User followed successfully',
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const unfollowUserController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;

    await unfollowUser(req.user.userId, userId);

    return res.status(200).json({
      success: true,
      message: 'User unfollowed successfully',
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const getFollowersController = async (req: AuthRequest, res: Response) => {
  try {
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const currentUserId = req.user?.userId;

    const result = await getFollowers(userId, { page, limit }, currentUserId);

    return res.status(200).json({
      success: true,
      message: 'Followers retrieved successfully',
      data: result,
    });
  } catch (error) {
    console.error('Get followers error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getFollowingController = async (req: AuthRequest, res: Response) => {
  try {
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const currentUserId = req.user?.userId;

    const result = await getFollowing(userId, { page, limit }, currentUserId);

    return res.status(200).json({
      success: true,
      message: 'Following retrieved successfully',
      data: result,
    });
  } catch (error) {
    console.error('Get following error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getFollowStatusController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    const following = await isFollowing(req.user.userId, userId);

    return res.status(200).json({
      success: true,
      data: { isFollowing: following },
    });
  } catch (error) {
    console.error('Get follow status error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};