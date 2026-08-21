import ShopSetting from '../models/ShopSetting.js';

export const rejectDuringObsTest = async (req, res, next) => {
  try {
    const settings = await ShopSetting.findOne({ shopId: req.shopId }).select('obsTest.active').lean();
    if (settings?.obsTest?.active) {
      return res.status(409).json({
        success: false,
        code: 'OBS_TEST_ACTIVE',
        message: 'กำลังทดสอบจอ กรุณาลองใหม่อีกครั้งหลังการทดสอบเสร็จ',
      });
    }
    return next();
  } catch (error) {
    return next(error);
  }
};
