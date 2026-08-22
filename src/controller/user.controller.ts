import { Request, Response } from 'express';
import "multer";
import {
  getUserProfile,
  getMyPhotos,
  deleteAccount,
  updateProfile,
  updateAvatar,
  PaginationParams,
} from '@/service/user.service';
import { uploadImage } from '@/service/imagekit.service';

type AuthRequest = Request & {
  user?: {
    userId: string;
    sessionId: string;
    username: string;
  };
};

type MulterRequest = Request & { file?: Express.Multer.File };

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

export const updateProfileController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { displayName, bio, website } = req.body;

    const updated = await updateProfile(req.user.userId, { displayName, bio, website });

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: updated.id,
        username: updated.username,
        email: updated.email,
        avatarUrl: updated.avatarUrl,
        displayName: updated.displayName,
        bio: updated.bio,
        website: updated.website,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case 'DISPLAY_NAME_TOO_LONG':
          return res.status(400).json({ success: false, message: 'Display name too long (max 100 characters)' });
        case 'BIO_TOO_LONG':
          return res.status(400).json({ success: false, message: 'Bio too long (max 500 characters)' });
        case 'WEBSITE_TOO_LONG':
          return res.status(400).json({ success: false, message: 'Website URL too long (max 500 characters)' });
        case 'INVALID_WEBSITE_URL':
          return res.status(400).json({ success: false, message: 'Invalid website URL (must start with http:// or https://)' });
      }
    }
    console.error('Update profile error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const uploadAvatarController = async (req: MulterRequest & AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ success: false, message: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.' });
    }

    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: 'File too large (max 5MB)' });
    }

    const result = await uploadImage(req.file.buffer, req.file.originalname);

    const updated = await updateAvatar(req.user.userId, result.url);

    return res.status(200).json({
      success: true,
      message: 'Avatar updated successfully',
      data: {
        avatarUrl: updated.avatarUrl,
      },
    });
  } catch (error) {
    console.error('Upload avatar error:', error);
    return res.status(500).json({ success: false, message: 'Failed to upload avatar' });
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