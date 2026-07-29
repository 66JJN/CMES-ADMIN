/**
 * OBS Routes — OBS Overlay + Lucky Wheel
 */
import express from 'express';
import { requireAdminAuth } from '../middleware/authMiddleware.js';
import {
  getObsOverlay,
  getObsDisplayToken,
  spinLuckyWheel,
  hideLuckyWheel,
  previewLuckyWheel
} from '../controllers/obsController.js';

const router = express.Router();

// GET /obs-image-overlay.html
router.get('/obs-image-overlay.html', getObsOverlay);
router.get('/api/obs/display-token', requireAdminAuth, getObsDisplayToken);

// POST /api/lucky-wheel/spin
router.post('/api/lucky-wheel/spin', requireAdminAuth, spinLuckyWheel);

// POST /api/lucky-wheel/hide
router.post('/api/lucky-wheel/hide', requireAdminAuth, hideLuckyWheel);

// POST /api/lucky-wheel/preview
router.post('/api/lucky-wheel/preview', requireAdminAuth, previewLuckyWheel);

export default router;
