import { Router } from 'express';
import { SlackController } from '../controllers/slack.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Callback is invoked by Slack redirect
router.get('/callback', SlackController.callback);

router.use(requireAuth);
router.get('/connect', SlackController.connect);
router.get('/status', SlackController.getStatus);
router.post('/disconnect', SlackController.disconnect);

export default router;
