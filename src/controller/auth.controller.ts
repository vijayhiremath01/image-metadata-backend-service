import { Request, Response } from 'express';
import {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  getUserById,
  RegisterInput,
  LoginInput,
  AuthResult,
} from '@/service/auth.service';

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
      case 'EMAIL_EXISTS':
        return res.status(409).json({ success: false, message: 'Email already registered' });
      case 'USERNAME_EXISTS':
        return res.status(409).json({ success: false, message: 'Username already taken' });
      case 'INVALID_CREDENTIALS':
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      case 'INVALID_REFRESH_TOKEN':
        return res.status(401).json({ success: false, message: 'Invalid refresh token' });
      case 'SESSION_NOT_FOUND':
        return res.status(401).json({ success: false, message: 'Session not found' });
      case 'SESSION_REVOKED':
        return res.status(401).json({ success: false, message: 'Session has been revoked' });
      case 'SESSION_EXPIRED':
        return res.status(401).json({ success: false, message: 'Session has expired' });
      case 'USER_NOT_FOUND':
        return res.status(404).json({ success: false, message: 'User not found' });
    }
  }
  console.error('Auth error:', error);
  return res.status(500).json({ success: false, message: 'Internal server error' });
};

export const registerController = async (req: Request, res: Response) => {
  try {
    const input: RegisterInput = req.body;
    const result = await register(input);
    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: result,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const loginController = async (req: Request, res: Response) => {
  try {
    const input: LoginInput = req.body;
    const result = await login(input);
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const refreshController = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token required' });
    }
    const result = await refresh(refreshToken);
    return res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: result,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const logoutController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    await logout(req.user.sessionId, req.user.userId);
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const logoutAllController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    await logoutAll(req.user.userId);
    return res.status(200).json({
      success: true,
      message: 'Logged out from all devices successfully',
    });
  } catch (error) {
    console.error('Logout all error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const meController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const user = await getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.status(200).json({
      success: true,
      message: 'User retrieved successfully',
      data: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    console.error('Me error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};