import { Router } from 'express';
import authRoutes from './auth.routes';
import emailRoutes from './email.routes';
import slackRoutes from './slack.routes';
import healthRoutes from './health.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/emails', emailRoutes);
router.use('/slack', slackRoutes);
router.use('/health', healthRoutes);

export default router;
