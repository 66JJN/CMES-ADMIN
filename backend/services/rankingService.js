/**
 * Ranking Service — แกนกลางคำนวณแต้มที่ทุก Domain เรียกใช้ได้
 * ใช้โดย: giftController, queueController
 */
import Ranking from '../models/Ranking.js';
import RankingHistory from '../models/RankingHistory.js';
import { getThaiDateStr, getThaiMonthStr, getThaiYearStr } from '../helpers/timezone.js';

/**
 * บันทึกคะแนน ranking สำหรับผู้ใช้ที่ทำการสนับสนุน
 * 🔥 Multi-tenant: แยกตาม shopId
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.name
 * @param {number} params.amount
 * @param {string} params.email
 * @param {string} params.avatar
 * @param {string} params.shopId
 * @param {object} io — Socket.IO instance (จาก req.app.get('socketio'))
 */
export async function addRankingPoint({ userId, name, amount, email = null, avatar = null, shopId }, io) {
  try {
    console.log(`[Ranking] addRankingPoint called: shopId=${shopId}, userId=${userId}, name=${name}, amount=${amount}, email=${email}`);

    const points = Number(amount);
    if (isNaN(points) || points <= 0) {
      console.log("[Ranking] ข้าม: คะแนนไม่ถูกต้อง");
      return;
    }

    if (!shopId) {
      console.log("[Ranking] ข้าม: ไม่มี shopId");
      return;
    }

    if (!userId || userId === "guest" || userId === "unknown") {
      console.log("[Ranking] ข้าม: ผู้ใช้แบบ guest/unknown");
      return;
    }

    const userName = (name || "Guest").trim() || "Guest";
    const today = getThaiDateStr();
    const currentMonth = getThaiMonthStr();
    const currentYear = getThaiYearStr();

    // ===== 1. บันทึกประวัติลง RankingHistory (เก็บทุกรายการ) =====
    try {
      await RankingHistory.create({
        shopId, userId, name: userName, email, avatar,
        amount: points, date: today, month: currentMonth, year: currentYear
      });
      console.log(`[Ranking] บันทึกประวัติ: ${userName} +${points} วันที่ ${today}`);
    } catch (histErr) {
      console.error("[Ranking] Error saving history:", histErr.message);
    }

    // ===== 2. อัพเดท Ranking สรุป =====
    let ranking = await Ranking.findOne({ userId, shopId });
    if (ranking) {
      ranking.points = (ranking.points || 0) + points;

      if (ranking.dailyDate !== today) {
        ranking.dailyPoints = points;
        ranking.dailyDate = today;
      } else {
        ranking.dailyPoints = (ranking.dailyPoints || 0) + points;
      }

      if (ranking.monthlyPeriod !== currentMonth) {
        ranking.monthlyPoints = points;
        ranking.monthlyPeriod = currentMonth;
      } else {
        ranking.monthlyPoints = (ranking.monthlyPoints || 0) + points;
      }

      ranking.name = userName;
      if (email) ranking.email = email;
      if (avatar) ranking.avatar = avatar;
      ranking.updatedAt = new Date();
      await ranking.save();
      console.log(`[Ranking] อัปเดต ${userName} (${userId}): +${points} คะแนน, ทั้งหมด: ${ranking.points}, รายวัน: ${ranking.dailyPoints}, รายเดือน: ${ranking.monthlyPoints}`);
    } else {
      ranking = await Ranking.create({
        shopId, userId, name: userName, email, avatar,
        points, dailyPoints: points, dailyDate: today,
        monthlyPoints: points, monthlyPeriod: currentMonth,
        updatedAt: new Date()
      });
      console.log(`[Ranking] สร้างใหม่ ${userName} (${userId}): ${points} คะแนน`);
    }

    // ส่งข้อมูลการอัปเดต ranking ไปยัง clients ของ shop นี้เท่านั้น
    if (io) {
      const topRankings = await Ranking.find({ shopId }).sort({ points: -1 }).limit(10);
      const formattedRankings = topRankings.map((r, index) => ({
        ...r.toObject(),
        rank: index + 1
      }));
      io.to(shopId).emit("ranking-update", formattedRankings);
    }
  } catch (error) {
    console.error("[Ranking] Error adding points:", error.message);
  }
}
