/**
 * Status Routes — Login, Health, System Config, Time History, Change ShopId, Settings History, Admin Report, Stat-Slip
 */
import express from 'express';
import { requireShopId, requireAdminAuth } from '../middleware/authMiddleware.js';
import {
  login,
  healthCheck,
  getSystemStatus,
  updateSystemConfig,
  getTimeHistory,
  createTimeHistory,
  deleteTimeHistory,
  getSettingsHistory,
  getAdminReport,
  getStatSlip,
  postStatSlip,
  changeShopId,
  changePassword
} from '../controllers/statusController.js';

const router = express.Router();

// ADMIN LOGIN
router.post('/login', login);

// HEALTH CHECK
router.get('/health', healthCheck);

// SYSTEM STATUS / CONFIG
router.get('/api/status', requireShopId, getSystemStatus);
router.post('/api/config/update', requireAdminAuth, updateSystemConfig);

// TIME HISTORY
router.get('/api/time-history', requireAdminAuth, getTimeHistory);
router.post('/api/time-history', requireAdminAuth, createTimeHistory);
router.delete('/api/time-history/:id', requireAdminAuth, deleteTimeHistory);

// SETTINGS HISTORY
router.get('/api/settings-history', getSettingsHistory);

// ADMIN REPORT
router.get('/api/admin/report', getAdminReport);

// STAT-SLIP
router.get('/api/stat-slip', getStatSlip);
router.post('/api/stat-slip', postStatSlip);

// CHANGE PASSWORD
router.post('/api/admin/change-password', requireAdminAuth, changePassword);

export default router;
