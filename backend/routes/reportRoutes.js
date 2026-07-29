/**
 * Report Routes — กำหนดสิทธิ์และคู่สาย
 */
import express from 'express';
import { requireAdminAuth, requireUserServiceAuth } from '../middleware/authMiddleware.js';
import { createReport, getReports, updateReportStatus } from '../controllers/reportController.js';

const router = express.Router();

// POST /api/report — รับ report จาก USER backend (ไม่ต้อง auth — public)
router.post('/report', requireUserServiceAuth, createReport);

// GET /api/reports — ดึงรายการ report ทั้งหมด (ต้อง Admin auth)
router.get('/reports', requireAdminAuth, getReports);

// PATCH /api/reports/:id — อัปเดตสถานะ report (ต้อง Admin auth)
router.patch('/reports/:id', requireAdminAuth, updateReportStatus);

export default router;
