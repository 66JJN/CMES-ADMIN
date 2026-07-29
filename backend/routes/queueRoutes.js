/**
 * Queue Routes — Upload, Queue CRUD, Approve/Reject/Complete/Playing, History, Order Status
 */
import express from 'express';
import { requireShopId, requireAdminAuth, requireUserServiceAuth } from '../middleware/authMiddleware.js';
import {
  uploadItem,
  checkSubmissionEligibility,
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
  adminDeleteQueueItem,
  getQueueControlStatus,
  setQueuePaused,
  retryInterruptedQueue
} from '../controllers/queueController.js';

const router = express.Router();

// NOTE: uploadUser multer middleware is mounted in server.js for /api/upload
router.post('/upload', requireUserServiceAuth, uploadItem);
router.post('/queue/eligibility', requireUserServiceAuth, checkSubmissionEligibility);

router.get('/queue', requireAdminAuth, getQueue);
router.get('/queue/control', requireAdminAuth, getQueueControlStatus);
router.post('/queue/pause', requireAdminAuth, (req, res, next) => { req.params.action = 'pause'; return setQueuePaused(req, res, next); });
router.post('/queue/resume', requireAdminAuth, (req, res, next) => { req.params.action = 'resume'; return setQueuePaused(req, res, next); });
router.post('/queue/retry', requireAdminAuth, retryInterruptedQueue);

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
