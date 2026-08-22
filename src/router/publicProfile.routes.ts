import { Router } from 'express';
import { getPublicProfileController, getUserPhotosController } from '@/controller/publicProfile.controller';

const router = Router();

router.get('/:username', getPublicProfileController);
router.get('/:username/photos', getUserPhotosController);

export default router;