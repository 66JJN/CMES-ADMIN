/**
 * OBS Controller — Business Logic สำหรับ OBS Overlay และ Lucky Wheel
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { signDisplayToken } from '../middleware/authMiddleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// GET /obs-image-overlay.html
export const getObsOverlay = (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'obs-image-overlay.html'));
};

// Admin creates a short-lived, read-only token for an OBS browser source.
export const getObsDisplayToken = (req, res) => {
  try {
    res.json({ success: true, token: signDisplayToken(req.shopId) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to create OBS token' });
  }
};

// POST /api/lucky-wheel/spin
export const spinLuckyWheel = (req, res) => {
  const { shopId } = req;
  const { segments, winnerIndex, reward } = req.body;

  if (!segments || winnerIndex === undefined) {
    return res.status(400).json({ error: 'Missing segments or winnerIndex' });
  }
  console.log(`[LuckyWheel][${shopId}] Spin event received. Winner Index:`, winnerIndex);

  const io = req.app.get('socketio');
  if (io) {
    io.to(shopId).emit('lucky-wheel-spin', { segments, winnerIndex, reward, timestamp: Date.now() });
  }

  return res.json({ success: true, message: 'Spin event broadcasted' });
};

// POST /api/lucky-wheel/hide
export const hideLuckyWheel = (req, res) => {
  const { shopId } = req;
  const io = req.app.get('socketio');
  if (io) io.to(shopId).emit('lucky-wheel-hide');
  return res.json({ success: true, message: 'Hide event broadcasted' });
};

// POST /api/lucky-wheel/preview
export const previewLuckyWheel = (req, res) => {
  const { shopId } = req;
  const { segments } = req.body;
  if (!segments) return res.status(400).json({ error: 'Missing segments' });

  const io = req.app.get('socketio');
  if (io) io.to(shopId).emit('lucky-wheel-preview', { segments });
  return res.json({ success: true });
};
