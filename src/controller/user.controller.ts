import { Request, Response } from 'express';
import {
  getUserProfile,
  getMyPhotos,
  deleteAccount,
  PaginationParams,
} from '@/service/user.service';

type AuthRequest = Request & {
  user?: {
    userId: string;
    sessionId: string;
    username: string;
  };
};

export const getMeController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const profile = await getUserProfile(req.user.userId);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.status(200).json({
      success: true,
      message: 'Profile retrieved successfully',
      data: profile,
    });
  } catch (error) {
    console.error('Get me error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getMyPhotosController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    const result = await getMyPhotos(req.user.userId, { page, limit });

    return res.status(200).json({
      success: true,
      message: 'Your photos retrieved successfully',
      data: result,
    });
  } catch (error) {
    console.error('Get my photos error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteAccountController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    await deleteAccount(req.user.userId);
    return res.status(200).json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    console.error('Delete account error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};