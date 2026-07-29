/**
 * Gift Routes — CRUD สินค้า, คำสั่งซื้อ, อัปโหลดรูป, Birthday Eligibility
 */
import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { requireAdminAuth, requireAdminOrUserServiceAuth, requireDisplayAuth, requireUserServiceAuth } from '../middleware/authMiddleware.js';
import {
  getGiftSettings, createGiftItem, updateGiftItem, deleteGiftItem,
  updateTableCount, uploadGiftImage, createGiftOrder, updateGiftOrderItems,
  checkBirthdayEligibility
} from '../controllers/giftController.js';

const router = express.Router();

// Gift Storage (Cloudinary)
const giftStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'cmes-admin/gifts',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [{ width: 800, height: 800, crop: 'limit' }],
    public_id: (req, file) => `gift-${Date.now()}-${Math.round(Math.random() * 1e9)}`
  }
});
const uploadGift = multer({ storage: giftStorage });

// Gift Settings & CRUD
router.get('/settings', requireAdminOrUserServiceAuth, getGiftSettings);
router.get('/display-settings', requireDisplayAuth, getGiftSettings);
router.post('/items', requireAdminAuth, createGiftItem);
router.put('/items/:id', requireAdminAuth, updateGiftItem);
router.delete('/items/:id', requireAdminAuth, deleteGiftItem);
router.patch('/table-count', requireAdminAuth, updateTableCount);
router.post('/upload', requireAdminAuth, uploadGift.single('image'), uploadGiftImage);

// Gift Order (จาก User Backend)
router.post('/order', requireUserServiceAuth, createGiftOrder);

export default router;

// === Exports สำหรับ mount แยกใน server.js ===
export { updateGiftOrderItems, checkBirthdayEligibility };
