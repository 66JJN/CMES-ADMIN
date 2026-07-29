/**
 * Config Routes — Birthday Requirement, Perks, Payment QR Code
 */
import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { requireAdminAuth, requireAdminOrUserServiceAuth } from '../middleware/authMiddleware.js';
import {
  getBirthdayRequirement, updateBirthdayRequirement,
  getPerks, updatePerks,
  uploadPaymentQr, getPaymentQr
} from '../controllers/configController.js';

const router = express.Router();

// Payment QR Storage (Cloudinary)
const paymentQrStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'cmes-admin/payment-qr',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [{ width: 800, height: 800, crop: 'limit' }],
    public_id: (req, file) => `payment-qr-${req.shopId || 'shop'}-${Date.now()}`
  }
});
const uploadPaymentQrMiddleware = multer({ storage: paymentQrStorage }).single('paymentQr');

// Birthday Requirement
router.get('/birthday-requirement', requireAdminAuth, getBirthdayRequirement);
router.post('/birthday-requirement', requireAdminAuth, updateBirthdayRequirement);

// Perks
router.get('/perks', requireAdminOrUserServiceAuth, getPerks);
router.post('/perks', requireAdminAuth, updatePerks);

// Payment QR Code
router.get('/payment-qr', requireAdminOrUserServiceAuth, getPaymentQr);
router.post('/payment-qr', requireAdminAuth, (req, res, next) => {
  uploadPaymentQrMiddleware(req, res, (err) => {
    if (err) {
      console.error('[PaymentQR] Multer error:', err.message);
      return res.status(400).json({ success: false, message: 'อัปโหลดรูปภาพล้มเหลว: ' + err.message });
    }
    next();
  });
}, uploadPaymentQr);

export default router;
