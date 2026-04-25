/**
 * contentModeration.js — AI Content Moderation using SightEngine
 * ตรวจสอบรูปภาพอัตโนมัติก่อนอนุมัติขึ้นจอ
 * 
 * Flow:
 *   1. รูปถูกอัปโหลดไป Cloudinary แล้วได้ URL กลับมา
 *   2. ส่ง URL ให้ SightEngine ตรวจสอบ
 *   3. ถ้าผ่าน → auto-approve (status: "approved")
 *   4. ถ้าไม่ผ่าน → ค้างใน queue (status: "pending") ให้ Admin ตรวจสอบ
 * 
 * Free Tier: 2,000 operations/month, 500/day
 */

import fetch from 'node-fetch';

// ===== Configuration =====
// อ่านค่า env แบบ lazy (ตอนเรียกใช้งาน) เพราะ dotenv.config() อาจยังไม่ทำงานตอน import
function getApiUser() { return process.env.SIGHTENGINE_API_USER || ''; }
function getApiSecret() { return process.env.SIGHTENGINE_API_SECRET || ''; }

// เกณฑ์ความปลอดภัย (0.0 - 1.0)
// ค่ายิ่งต่ำ = เข้มงวดมากขึ้น (ปฏิเสธง่ายขึ้น)
const THRESHOLDS = {
  nudity: 0.40,          // เนื้อหาโป๊เปลือย (ค่าต่ำกว่านี้ถือว่าปลอดภัย)
  weapon: 0.60,          // อาวุธ
  alcohol: 0.80,         // เครื่องดื่มแอลกอฮอล์ (ผ่อนปรนกว่า เพราะร้านอาจขายเครื่องดื่ม)
  drugs: 0.50,           // ยาเสพติด
  offensive: 0.50,       // เนื้อหาน่ารังเกียจ/รุนแรง
  gore: 0.40,            // เลือด/ความรุนแรง
  scam: 0.70,            // การหลอกลวง
};

/**
 * ตรวจสอบความเหมาะสมของรูปภาพด้วย SightEngine AI
 * 
 * @param {string} imageUrl - URL ของรูปภาพ (Cloudinary URL)
 * @returns {Object} ผลการตรวจสอบ
 *   - safe: boolean (true = ปลอดภัย, false = ต้องตรวจสอบ)
 *   - reasons: string[] (เหตุผลที่ไม่ผ่าน)
 *   - scores: Object (คะแนนดิบจาก AI)
 *   - aiChecked: boolean (true = AI ตรวจสอบแล้ว)
 */
export async function moderateImage(imageUrl) {
  // ถ้าไม่มี API key → ข้ามการตรวจสอบ (ทำงานแบบเดิม)
  if (!getApiUser() || !getApiSecret()) {
    console.log('[AI Moderation] ⚠ ไม่มี API key — ข้ามการตรวจสอบ AI');
    return {
      safe: false,  // ไม่ auto-approve ถ้าไม่มี AI
      reasons: ['AI moderation not configured'],
      scores: {},
      aiChecked: false
    };
  }

  // ตรวจสอบว่ามี URL รูปภาพหรือไม่
  if (!imageUrl) {
    return {
      safe: false,
      reasons: ['No image URL provided'],
      scores: {},
      aiChecked: false
    };
  }

  try {
    console.log(`[AI Moderation] 🔍 กำลังตรวจสอบรูปภาพ: ${imageUrl.substring(0, 80)}...`);

    // เรียก SightEngine API
    const params = new URLSearchParams({
      url: imageUrl,
      models: 'nudity-2.1,weapon,alcohol,recreational_drug,offensive,gore',
      api_user: getApiUser(),
      api_secret: getApiSecret()
    });

    const response = await fetch(`https://api.sightengine.com/1.0/check.json?${params}`, {
      method: 'GET',
      timeout: 10000 // 10 seconds timeout
    });

    if (!response.ok) {
      console.error(`[AI Moderation] ✗ API error: ${response.status}`);
      // ถ้า API ล้มเหลว → ให้ Admin ตรวจสอบเอง (ไม่ auto-approve)
      return {
        safe: false,
        reasons: [`API error: ${response.status}`],
        scores: {},
        aiChecked: false
      };
    }

    const result = await response.json();

    if (result.status !== 'success') {
      console.error('[AI Moderation] ✗ API returned error:', result);
      return {
        safe: false,
        reasons: ['API check failed'],
        scores: {},
        aiChecked: false
      };
    }

    // ===== วิเคราะห์ผลลัพธ์ =====
    const reasons = [];
    const scores = {};

    // 1. ตรวจสอบ Nudity
    if (result.nudity) {
      const nudityScore = result.nudity.sexual_activity || result.nudity.sexual_display || result.nudity.erotica || 0;
      scores.nudity = nudityScore;
      if (nudityScore > THRESHOLDS.nudity) {
        reasons.push(`เนื้อหาไม่เหมาะสม (nudity: ${(nudityScore * 100).toFixed(1)}%)`);
      }
    }

    // 2. ตรวจสอบ Weapon
    if (result.weapon) {
      const weaponScore = result.weapon?.classes?.firearm || result.weapon?.classes?.knife || 0;
      scores.weapon = weaponScore;
      if (weaponScore > THRESHOLDS.weapon) {
        reasons.push(`พบอาวุธ (weapon: ${(weaponScore * 100).toFixed(1)}%)`);
      }
    }

    // 3. ตรวจสอบ Alcohol
    if (result.alcohol) {
      const alcoholScore = result.alcohol?.prob || 0;
      scores.alcohol = alcoholScore;
      if (alcoholScore > THRESHOLDS.alcohol) {
        reasons.push(`พบเครื่องดื่มแอลกอฮอล์ (alcohol: ${(alcoholScore * 100).toFixed(1)}%)`);
      }
    }

    // 4. ตรวจสอบ Drugs
    if (result.recreational_drug) {
      const drugScore = result.recreational_drug?.prob || 0;
      scores.drugs = drugScore;
      if (drugScore > THRESHOLDS.drugs) {
        reasons.push(`พบยาเสพติด (drugs: ${(drugScore * 100).toFixed(1)}%)`);
      }
    }

    // 5. ตรวจสอบ Offensive content
    if (result.offensive) {
      const offensiveScore = result.offensive?.prob || 0;
      scores.offensive = offensiveScore;
      if (offensiveScore > THRESHOLDS.offensive) {
        reasons.push(`เนื้อหาน่ารังเกียจ (offensive: ${(offensiveScore * 100).toFixed(1)}%)`);
      }
    }

    // 6. ตรวจสอบ Gore
    if (result.gore) {
      const goreScore = result.gore?.prob || 0;
      scores.gore = goreScore;
      if (goreScore > THRESHOLDS.gore) {
        reasons.push(`เนื้อหารุนแรง/เลือด (gore: ${(goreScore * 100).toFixed(1)}%)`);
      }
    }

    const isSafe = reasons.length === 0;

    if (isSafe) {
      console.log(`[AI Moderation] ✓ รูปภาพปลอดภัย — อนุมัติอัตโนมัติ`);
    } else {
      console.log(`[AI Moderation] ⚠ รูปภาพอาจไม่เหมาะสม — ส่งให้ Admin ตรวจสอบ`);
      console.log(`[AI Moderation]   เหตุผล: ${reasons.join(', ')}`);
    }

    return {
      safe: isSafe,
      reasons,
      scores,
      aiChecked: true
    };

  } catch (error) {
    console.error('[AI Moderation] ✗ Error:', error.message);
    // ถ้าเกิดข้อผิดพลาด → ให้ Admin ตรวจสอบเอง
    return {
      safe: false,
      reasons: [`Error: ${error.message}`],
      scores: {},
      aiChecked: false
    };
  }
}

/**
 * ตรวจสอบว่าระบบ AI Moderation ถูกตั้งค่าแล้วหรือยัง
 */
export function isAIModerationEnabled() {
  return !!(getApiUser() && getApiSecret());
}
