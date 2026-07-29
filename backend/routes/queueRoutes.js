/**
 * Queue Routes — Upload, Queue CRUD, Approve/Reject/Complete/Playing, History, Order Status
 */
import express from 'express';
import { requireShopId, requireAdminAuth, requireUserServiceAuth } from '../middleware/authMiddleware.js';
import {
  uploadItem,
  getQueue,
  confirmPayment,
  markAsPlaying,
  approveItem,
  rejectItem,
  manualCompleteItem,
  restoreHistoryItem,
  getCheckHistory,
  deleteHistoryItem,
  deleteAllHistory,
  getBriefHistory,
  getOrderStatus,
  userDeleteOrder,
  adminDeleteQueueItem
} from '../controllers/queueController.js';

const router = express.Router();

// NOTE: uploadUser multer middleware is mounted in server.js for /api/upload
router.post('/upload', requireUserServiceAuth, uploadItem);

router.get('/queue', requireAdminAuth, getQueue);

router.post('/confirm-payment/:uploadId', requireAdminAuth, confirmPayment);

router.post('/playing/:id', requireAdminAuth, markAsPlaying);

router.post('/approve/:id', requireAdminAuth, approveItem);

router.post('/reject/:id', requireAdminAuth, rejectItem);

router.post('/complete/:id', requireAdminAuth, manualCompleteItem);

router.post('/history/restore/:id', requireAdminAuth, restoreHistoryItem);

router.get('/check-history', requireAdminAuth, getCheckHistory);

router.post('/delete-history', requireAdminAuth, deleteHistoryItem);

router.post('/delete-all-history', requireAdminAuth, deleteAllHistory);

router.get('/history', requireAdminAuth, getBriefHistory);

router.get('/order-status/:orderId', requireUserServiceAuth, getOrderStatus);

router.delete('/user-delete-order/:orderId', requireUserServiceAuth, userDeleteOrder);

router.delete('/delete/:id', requireAdminAuth, adminDeleteQueueItem);

export default router;
