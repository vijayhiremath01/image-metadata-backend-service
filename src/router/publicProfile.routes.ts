import { Router } from 'express';
import { optionalAuthMiddleware } from '@/middleware/auth.middleware';
import { getPublicProfileController, getUserPhotosController } from '@/controller/publicProfile.controller';

const router = Router();

router.get('/:username', optionalAuthMiddleware, getPublicProfileController);
router.get('/:username/photos', optionalAuthMiddleware, getUserPhotosController);

export default router;