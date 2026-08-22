/**
 * ตรวจรูปภาพผ่านผู้ให้บริการที่ร้านเลือก แล้วคืนผลในรูปแบบเดียวกัน
 * เพื่อไม่ให้ Queue Controller ต้องรู้ว่าผลตอบกลับของแต่ละ API ต่างกันอย่างไร
 */

const DEFAULT_PROVIDER = 'sightengine';
const SUPPORTED_PROVIDERS = new Set(['sightengine', 'objexify']);
const OBJEXIFY_ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);
const MAX_OBJEXIFY_IMAGE_BYTES = 10 * 1024 * 1024;

const getSightengineApiUser = () => process.env.SIGHTENGINE_API_USER || '';
const getSightengineApiSecret = () => process.env.SIGHTENGINE_API_SECRET || '';
const getObjexifyBaseUrl = () => (process.env.OBJEXIFY_API_BASE_URL || '').replace(/\/+$/, '');
const getObjexifyApiKey = () => process.env.OBJEXIFY_API_KEY || '';
const timeoutSignal = (milliseconds) => (
  typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(milliseconds) : undefined
);

const THRESHOLDS = {
  nudity: 0.40,
  weapon: 0.60,
  alcohol: 0.80,
  drugs: 0.50,
  offensive: 0.50,
  gore: 0.40,
};

export const isModerationProviderSupported = (provider) => SUPPORTED_PROVIDERS.has(provider);

export const normalizeModerationProvider = (provider) => (
  isModerationProviderSupported(provider) ? provider : DEFAULT_PROVIDER
);

export const getModerationProviderStatus = () => ({
  sightengine: {
    configured: Boolean(getSightengineApiUser() && getSightengineApiSecret()),
  },
  objexify: {
    configured: Boolean(getObjexifyBaseUrl() && getObjexifyApiKey()),
  },
});

const uncheckedResult = (provider, reason) => ({
  provider,
  safe: false,
  reasons: [reason],
  scores: {},
  aiChecked: false,
});

const moderateWithSightengine = async (imageUrl, fetchImpl) => {
  const provider = 'sightengine';
  if (!getSightengineApiUser() || !getSightengineApiSecret()) {
    console.warn('[AI Moderation] Sightengine ยังไม่ได้ตั้งค่า');
    return uncheckedResult(provider, 'Sightengine ยังไม่ได้ตั้งค่า');
  }

  try {
    const params = new URLSearchParams({
      url: imageUrl,
      models: 'nudity-2.1,weapon,alcohol,recreational_drug,offensive,gore',
      api_user: getSightengineApiUser(),
      api_secret: getSightengineApiSecret(),
    });
    const response = await fetchImpl(`https://api.sightengine.com/1.0/check.json?${params}`, {
      method: 'GET',
      signal: timeoutSignal(10000),
    });

    if (!response.ok) {
      return uncheckedResult(provider, `Sightengine ตอบกลับ HTTP ${response.status}`);
    }

    const result = await response.json();
    if (result.status !== 'success') {
      return uncheckedResult(provider, 'Sightengine ไม่สามารถตรวจรูปภาพได้');
    }

    const reasons = [];
    const scores = {};
    if (result.nudity) {
      const score = Math.max(
        Number(result.nudity.sexual_activity) || 0,
        Number(result.nudity.sexual_display) || 0,
        Number(result.nudity.erotica) || 0
      );
      scores.nudity = score;
      if (score > THRESHOLDS.nudity) reasons.push(`เนื้อหาไม่เหมาะสม (nudity: ${(score * 100).toFixed(1)}%)`);
    }
    if (result.weapon) {
      const score = Math.max(
        Number(result.weapon?.classes?.firearm) || 0,
        Number(result.weapon?.classes?.knife) || 0
      );
      scores.weapon = score;
      if (score > THRESHOLDS.weapon) reasons.push(`พบอาวุธ (weapon: ${(score * 100).toFixed(1)}%)`);
    }
    if (result.alcohol) {
      const score = result.alcohol?.prob || 0;
      scores.alcohol = score;
      if (score > THRESHOLDS.alcohol) reasons.push(`พบเครื่องดื่มแอลกอฮอล์ (alcohol: ${(score * 100).toFixed(1)}%)`);
    }
    if (result.recreational_drug) {
      const score = result.recreational_drug?.prob || 0;
      scores.drugs = score;
      if (score > THRESHOLDS.drugs) reasons.push(`พบยาเสพติด (drugs: ${(score * 100).toFixed(1)}%)`);
    }
    if (result.offensive) {
      const score = result.offensive?.prob || 0;
      scores.offensive = score;
      if (score > THRESHOLDS.offensive) reasons.push(`เนื้อหาน่ารังเกียจ (offensive: ${(score * 100).toFixed(1)}%)`);
    }
    if (result.gore) {
      const score = result.gore?.prob || 0;
      scores.gore = score;
      if (score > THRESHOLDS.gore) reasons.push(`เนื้อหารุนแรง/เลือด (gore: ${(score * 100).toFixed(1)}%)`);
    }

    return {
      provider,
      safe: reasons.length === 0,
      reasons,
      scores,
      aiChecked: true,
    };
  } catch (error) {
    console.error('[AI Moderation][Sightengine] Error:', error.message);
    return uncheckedResult(provider, `Sightengine ขัดข้อง: ${error.message}`);
  }
};

const validateCloudinaryUrl = (imageUrl) => {
  try {
    const parsed = new URL(imageUrl);
    return parsed.protocol === 'https:' && parsed.hostname === 'res.cloudinary.com';
  } catch {
    return false;
  }
};

const responseToBuffer = async (response) => {
  if (typeof response.arrayBuffer === 'function') {
    return Buffer.from(await response.arrayBuffer());
  }
  if (typeof response.buffer === 'function') return response.buffer();
  throw new Error('ไม่สามารถอ่านไฟล์รูปภาพได้');
};

const makeObjexifyReasons = (results) => {
  const highestByLabel = new Map();
  for (const item of results) {
    for (const detection of item?.detections || []) {
      const label = String(detection?.label || '').trim();
      if (!label) continue;
      const confidence = Number(detection?.confidence) || 0;
      highestByLabel.set(label, Math.max(highestByLabel.get(label) || 0, confidence));
    }
  }

  const scores = Object.fromEntries(highestByLabel.entries());
  const reasons = [...highestByLabel.entries()].map(
    ([label, confidence]) => `พบเนื้อหาไม่เหมาะสม: ${label} (${(confidence * 100).toFixed(1)}%)`
  );
  return { scores, reasons };
};

const moderateWithObjexify = async (imageUrl, fetchImpl) => {
  const provider = 'objexify';
  const baseUrl = getObjexifyBaseUrl();
  const apiKey = getObjexifyApiKey();
  if (!baseUrl || !apiKey) {
    return uncheckedResult(provider, 'Objexify ยังไม่ได้ตั้งค่าใน Admin Backend');
  }
  if (!validateCloudinaryUrl(imageUrl)) {
    return uncheckedResult(provider, 'Objexify รับเฉพาะรูปจาก Cloudinary ของระบบ');
  }

  try {
    const imageResponse = await fetchImpl(imageUrl, {
      method: 'GET',
      signal: timeoutSignal(10000),
    });
    if (!imageResponse.ok) {
      return uncheckedResult(provider, `ดาวน์โหลดรูปจาก Cloudinary ไม่สำเร็จ (HTTP ${imageResponse.status})`);
    }

    const contentType = String(imageResponse.headers?.get?.('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!OBJEXIFY_ALLOWED_IMAGE_TYPES.has(contentType)) {
      return uncheckedResult(provider, 'Objexify รองรับเฉพาะไฟล์ JPG และ PNG');
    }

    const contentLength = Number(imageResponse.headers?.get?.('content-length')) || 0;
    if (contentLength > MAX_OBJEXIFY_IMAGE_BYTES) {
      return uncheckedResult(provider, 'ไฟล์รูปมีขนาดเกิน 10 MB');
    }

    const imageBuffer = await responseToBuffer(imageResponse);
    if (imageBuffer.length > MAX_OBJEXIFY_IMAGE_BYTES) {
      return uncheckedResult(provider, 'ไฟล์รูปมีขนาดเกิน 10 MB');
    }

    const extension = contentType === 'image/png' ? 'png' : 'jpg';
    const formData = new FormData();
    formData.append(
      'images',
      new Blob([imageBuffer], { type: contentType }),
      `cmes-upload.${extension}`
    );

    const response = await fetchImpl(`${baseUrl}/analyze-image`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
      },
      body: formData,
      signal: timeoutSignal(15000),
    });
    if (!response.ok) {
      return uncheckedResult(provider, `Objexify ตอบกลับ HTTP ${response.status}`);
    }

    const result = await response.json();
    if (!['passed', 'inappropriate'].includes(result?.status) || !Array.isArray(result?.results)) {
      return uncheckedResult(provider, 'Objexify ส่งผลตรวจกลับมาไม่ครบถ้วน');
    }
    if ((result.skipped || []).length > 0 || result.processed_count !== 1) {
      const reason = result.skipped?.[0]?.reason || 'ประมวลผลรูปไม่สำเร็จ';
      return uncheckedResult(provider, `Objexify ข้ามไฟล์: ${reason}`);
    }

    const { scores, reasons } = makeObjexifyReasons(result.results);
    const safe = result.status === 'passed' && reasons.length === 0;
    if (!safe && reasons.length === 0) reasons.push('Objexify ระบุว่ารูปภาพอาจไม่เหมาะสม');

    return { provider, safe, reasons, scores, aiChecked: true };
  } catch (error) {
    console.error('[AI Moderation][Objexify] Error:', error.message);
    return uncheckedResult(provider, `Objexify ขัดข้อง: ${error.message}`);
  }
};

/**
 * @param {string} imageUrl Cloudinary URL ของรูปที่ต้องตรวจ
 * @param {{provider?: string, fetchImpl?: Function}} options
 */
export async function moderateImage(imageUrl, options = {}) {
  const provider = normalizeModerationProvider(options.provider);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (!imageUrl) return uncheckedResult(provider, 'ไม่พบ URL รูปภาพ');
  if (typeof fetchImpl !== 'function') return uncheckedResult(provider, 'Server ไม่รองรับการเรียก API ตรวจรูปภาพ');
  if (provider === 'objexify') return moderateWithObjexify(imageUrl, fetchImpl);
  return moderateWithSightengine(imageUrl, fetchImpl);
}

export function isAIModerationEnabled(provider = DEFAULT_PROVIDER) {
  return getModerationProviderStatus()[normalizeModerationProvider(provider)].configured;
}
