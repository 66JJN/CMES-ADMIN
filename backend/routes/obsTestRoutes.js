import express from 'express';
import { requireAdminAuth } from '../middleware/authMiddleware.js';
import {
  getObsTestStatusController,
  startObsTestController,
  stopObsTestController,
} from '../controllers/obsTestController.js';

const router = express.Router();

router.get('/status', requireAdminAuth, getObsTestStatusController);
router.post('/start', requireAdminAuth, startObsTestController);
router.post('/stop', requireAdminAuth, stopObsTestController);

export default router;
