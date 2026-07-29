/**
 * Shop Routes — โปรไฟล์ร้านค้า, โลโก้, ชื่อร้าน
 */
import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { requireShopId, requireAdminAuth } from '../middleware/authMiddleware.js';
import { getShopProfile, uploadShopLogo, updateShopName } from '../controllers/shopController.js';

const router = express.Router();

// Logo Storage (Cloudinary)
const logoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'cmes-admin/shop-logos',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
    public_id: (req, file) => `logo-${req.shopId || 'shop'}-${Date.now()}`
  }
});
const uploadLogo = multer({ storage: logoStorage }).single('logo');

// GET /profile
router.get('/profile', requireAdminAuth, getShopProfile);
// Read-only data is consumed through CMES-USER; this route exposes no admin
// credentials or mutable settings.
router.get('/public-profile', requireShopId, getShopProfile);

// POST /logo (multer upload → controller)
router.post('/logo', requireAdminAuth, (req, res, next) => {
  uploadLogo(req, res, (err) => {
    if (err) {
      console.error('[ShopLogo] Multer error:', err.message);
      return res.status(400).json({ success: false, message: 'อัปโหลดรูปภาพล้มเหลว: ' + err.message });
    }
    next();
  });
}, uploadShopLogo);

// POST /name
router.post('/name', requireAdminAuth, updateShopName);

export default router;
