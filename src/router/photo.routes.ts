import { Router, Request, Response } from "express";
import rateLimit from 'express-rate-limit';
import {
  uploadPhoto,
  getAllPhotos,
  getPhotoByIdController,
  likePhotoController,
  unlikePhotoController,
  sharePhotoController,
  viewPhotoController,
  downloadPhotoController,
  getTrendingPhotos,
  getLatestPhotos,
  searchPhotos,
  deletePhotoController,
  getPhotosByCategory,
} from "@/controller/photo.controller";
import { upload } from "@/middleware/imagekit.middleware";
import { authMiddleware, optionalAuthMiddleware } from "@/middleware/auth.middleware";

const router = Router();

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      message: 'Too many upload attempts, please try again later.',
    });
  },
});

const likeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      message: 'Too many like requests, please try again later.',
    });
  },
});

const shareLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      message: 'Too many share requests, please try again later.',
    });
  },
});

const deleteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      message: 'Too many delete requests, please try again later.',
    });
  },
});

router.post("/upload", authMiddleware, uploadLimiter, upload.single("image"), uploadPhoto);

router.get("/", optionalAuthMiddleware, getAllPhotos);

router.get("/trending", optionalAuthMiddleware, getTrendingPhotos);

router.get("/latest", optionalAuthMiddleware, getLatestPhotos);

router.get("/search", optionalAuthMiddleware, searchPhotos);

router.get("/:id", optionalAuthMiddleware, getPhotoByIdController);

router.post("/:id/like", authMiddleware, likeLimiter, likePhotoController);

router.delete("/:id/like", authMiddleware, likeLimiter, unlikePhotoController);

router.post("/:id/share", authMiddleware, shareLimiter, sharePhotoController);

router.post("/:id/view", viewPhotoController);

router.post("/:id/download", downloadPhotoController);

router.delete("/:id", authMiddleware, deleteLimiter, deletePhotoController);

router.get("/category/:slug", optionalAuthMiddleware, getPhotosByCategory);

export default router;