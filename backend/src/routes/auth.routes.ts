import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/me', requireAuth, AuthController.getMe);
router.get('/google', AuthController.initiateGoogleAuth);
router.get('/google/callback', AuthController.handleGoogleCallback);
router.post('/login', AuthController.standardLogin);
router.post('/logout', AuthController.logout);

export default router;
