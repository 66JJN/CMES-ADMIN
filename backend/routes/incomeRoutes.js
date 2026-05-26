/**
 * Income Routes — สถิติรายรับ
 */
import express from 'express';
import { requireAdminAuth } from '../middleware/authMiddleware.js';
import { getIncomeStats } from '../controllers/incomeController.js';

const router = express.Router();

// GET /api/admin/income-stats
router.get('/income-stats', requireAdminAuth, getIncomeStats);

export default router;
