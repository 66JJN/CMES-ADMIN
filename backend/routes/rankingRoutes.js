/**
 * Ranking Routes — อันดับผู้สนับสนุน (daily, monthly, alltime)
 */
import express from 'express';
import { requireShopId, requireAdminAuth } from '../middleware/authMiddleware.js';
import {
  getRankings,
  getRankingSummary,
  getTopRankings,
  updateRankingAvatar
} from '../controllers/rankingController.js';

const router = express.Router();

// GET /api/rankings — ดึง ranking ทั้งหมดหรือตามจำนวนที่กำหนด
router.get('/', requireAdminAuth, getRankings);

// GET /api/rankings/summary
router.get('/summary', getRankingSummary);

// GET /api/rankings/top
router.get('/top', requireShopId, getTopRankings);

// PUT /api/rankings/update-avatar
router.put('/update-avatar', requireShopId, updateRankingAvatar);

export default router;
