import { Request, Response } from 'express';
import { getPublicProfile, getUserPhotos, PaginationParams } from '@/service/publicProfile.service';

type AuthenticatedRequest = Request & {
  user?: {
    userId: string;
    sessionId: string;
    username: string;
  };
};

export const getPublicProfileController = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
    const currentUserId = req.user?.userId;

    const profile = await getPublicProfile(username, currentUserId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile retrieved successfully',
      data: profile,
    });
  } catch (error) {
    console.error('Get public profile error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getUserPhotosController = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const currentUserId = req.user?.userId;

    const result = await getUserPhotos(username, { page, limit }, currentUserId);

    return res.status(200).json({
      success: true,
      message: 'User photos retrieved successfully',
      data: result,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    console.error('Get user photos error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};