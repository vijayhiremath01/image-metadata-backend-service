import { Request, Response } from "express";
import "multer";
import { uploadImage } from "@/service/imagekit.service";
import {
  createPhoto,
  getAllPhotos as getAllPhotosService,
  getAllPhotosWithLikeState,
  getPhotoById as getPhotoByIdService,
  getPhotoByIdWithOwner,
  getPhotoByIdWithOwnerAndLikeState,
  likePhoto as likePhotoService,
  unlikePhoto as unlikePhotoService,
  sharePhoto as sharePhotoService,
  viewPhoto as viewPhotoService,
  downloadPhoto as downloadPhotoService,
  getTrendingPhotos as getTrendingPhotosService,
  getTrendingPhotosWithLikeState,
  getLatestPhotos as getLatestPhotosService,
  getLatestPhotosWithLikeState,
  searchPhotos as searchPhotosService,
  searchPhotosWithLikeState,
  deletePhoto as deletePhotoService,
  getPhotosByCategorySlug as getPhotosByCategorySlugService,
  getPhotosByCategorySlugWithLikeState,
  PaginationParams,
} from "@/service/photo.service";
import { optionalAuthMiddleware, AuthenticatedRequest } from "@/middleware/auth.middleware";

type MulterRequest = Request & { file?: Express.Multer.File };
type AuthRequest = Request & {
  user?: {
    userId: string;
    sessionId: string;
    username: string;
  };
};

const getClientIp = (req: Request): string => {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0]).trim();
  }
  return req.socket.remoteAddress || "unknown";
};

export const uploadPhoto = async (req: MulterRequest & AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const result = await uploadImage(req.file.buffer, req.file.originalname);

    const photo = await createPhoto({
      userId: req.user.userId,
      title: req.body.title || req.file.originalname,
      description: req.body.description || "",
      originalUrl: result.url,
      displayUrl: result.url,
      thumbnailUrl: result.thumbnailUrl || result.url,
      width: result.width,
      height: result.height,
      sizeBytes: result.size,
      fileFormat: result.fileType,
      imagekitFileId: result.fileId,
    });

    return res.status(201).json({
      success: true,
      message: "Photo uploaded successfully",
      data: photo,
    });
  } catch (error) {
    console.error("Error uploading image:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload image",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getAllPhotos = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    const userId = req.user?.userId;
    const result = await getAllPhotosWithLikeState({ page, limit }, userId);

    return res.status(200).json({
      success: true,
      message: "Photos retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error fetching photos:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch photos",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getPhotoByIdController = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = req.user?.userId;
    const photo = await getPhotoByIdWithOwnerAndLikeState(id, userId);

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: "Photo not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Photo retrieved successfully",
      data: {
        ...photo.photo,
        owner: photo.owner,
        liked: photo.liked,
      },
    });
  } catch (error) {
    console.error("Error fetching photo:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch photo",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const likePhotoController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const result = await likePhotoService(id, req.user.userId);

    return res.status(200).json({
      success: true,
      message: "Photo liked successfully",
      data: result,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PHOTO_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Photo not found",
      });
    }
    if (error instanceof Error && error.message === "ALREADY_LIKED") {
      return res.status(409).json({
        success: false,
        message: "Photo already liked",
      });
    }
    console.error("Error liking photo:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to like photo",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const unlikePhotoController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const result = await unlikePhotoService(id, req.user.userId);

    return res.status(200).json({
      success: true,
      message: "Photo unliked successfully",
      data: result,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PHOTO_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Photo not found",
      });
    }
    if (error instanceof Error && error.message === "NOT_LIKED") {
      return res.status(409).json({
        success: false,
        message: "Photo not liked yet",
      });
    }
    console.error("Error unliking photo:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to unlike photo",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const sharePhotoController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const result = await sharePhotoService(id, req.user.userId);

    return res.status(200).json({
      success: true,
      message: "Photo shared successfully",
      data: {
        photoId: id,
        sharesCount: result.sharesCount,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PHOTO_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Photo not found",
      });
    }
    console.error("Error sharing photo:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to share photo",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const viewPhotoController = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const ipAddress = getClientIp(req);
    const userAgent = req.headers["user-agent"];

    await viewPhotoService(id, ipAddress, userAgent);

    return res.status(200).json({
      success: true,
      message: "View recorded successfully",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PHOTO_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Photo not found",
      });
    }
    console.error("Error recording view:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to record view",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const downloadPhotoController = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const ipAddress = getClientIp(req);
    const userAgent = req.headers["user-agent"];

    const downloadUrl = await downloadPhotoService(id, ipAddress, userAgent);

    return res.status(200).json({
      success: true,
      message: "Download recorded successfully",
      data: { downloadUrl },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PHOTO_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Photo not found",
      });
    }
    console.error("Error recording download:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to record download",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getTrendingPhotos = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    const userId = req.user?.userId;
    const result = await getTrendingPhotosWithLikeState({ page, limit }, userId);

    return res.status(200).json({
      success: true,
      message: "Trending photos retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error fetching trending photos:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch trending photos",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getLatestPhotos = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    const userId = req.user?.userId;
    const result = await getLatestPhotosWithLikeState({ page, limit }, userId);

    return res.status(200).json({
      success: true,
      message: "Latest photos retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error fetching latest photos:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch latest photos",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const searchPhotos = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const query = (req.query.q as string) || "";
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    if (!query.trim()) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const userId = req.user?.userId;
    const result = await searchPhotosWithLikeState(query, { page, limit }, userId);

    return res.status(200).json({
      success: true,
      message: "Search results retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error searching photos:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to search photos",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const deletePhotoController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    await deletePhotoService(id, req.user.userId);

    return res.status(200).json({
      success: true,
      message: "Photo deleted successfully",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PHOTO_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Photo not found",
      });
    }
    if (error instanceof Error && error.message === "NOT_OWNER") {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to perform this action",
      });
    }
    console.error("Error deleting photo:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete photo",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getPhotosByCategory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    const userId = req.user?.userId;
    const result = await getPhotosByCategorySlugWithLikeState(slug, { page, limit }, userId);

    return res.status(200).json({
      success: true,
      message: "Category photos retrieved successfully",
      data: result,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "CATEGORY_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }
    console.error("Error fetching category photos:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch category photos",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};