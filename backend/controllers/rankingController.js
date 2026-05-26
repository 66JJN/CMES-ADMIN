/**
 * Ranking Controller — Business Logic สำหรับระบบการจัดลำดับผู้สนับสนุน
 */
import Ranking from '../models/Ranking.js';
import RankingHistory from '../models/RankingHistory.js';
import { getThaiDateStr, getThaiMonthStr } from '../helpers/timezone.js';

// GET /api/rankings
export const getRankings = async (req, res) => {
  try {
    const { shopId } = req;
    const limit = parseInt(req.query.limit) || 10;
    const type = req.query.type || "alltime";

    const today = getThaiDateStr();
    const currentMonth = getThaiMonthStr();

    let query = { shopId };
    let sortField = { points: -1 };

    if (type === "daily") {
      const requestedDate = req.query.date || today;
      if (requestedDate !== today) {
        const pipeline = [
          { $match: { shopId, date: requestedDate } },
          {
            $group: {
              _id: "$userId", name: { $last: "$name" }, email: { $last: "$email" },
              avatar: { $last: "$avatar" }, userId: { $first: "$userId" },
              points: { $sum: "$amount" }, updatedAt: { $max: "$createdAt" }
            }
          },
          { $sort: { points: -1 } }, { $limit: limit }
        ];
        const results = await RankingHistory.aggregate(pipeline);
        const ranksWithPosition = results.map((r, idx) => ({ ...r, position: idx + 1 }));
        const totalCount = await RankingHistory.distinct("userId", { shopId, date: requestedDate });
        return res.json({ success: true, ranks: ranksWithPosition, total: totalCount.length, totalUsers: totalCount.length, type });
      }
      query = { shopId, dailyDate: today };
      sortField = { dailyPoints: -1 };
    } else if (type === "monthly") {
      const requestedMonth = req.query.month || currentMonth;
      if (requestedMonth !== currentMonth) {
        const pipeline = [
          { $match: { shopId, month: requestedMonth } },
          {
            $group: {
              _id: "$userId", name: { $last: "$name" }, email: { $last: "$email" },
              avatar: { $last: "$avatar" }, userId: { $first: "$userId" },
              points: { $sum: "$amount" }, updatedAt: { $max: "$createdAt" }
            }
          },
          { $sort: { points: -1 } }, { $limit: limit }
        ];
        const results = await RankingHistory.aggregate(pipeline);
        const ranksWithPosition = results.map((r, idx) => ({ ...r, position: idx + 1 }));
        const totalCount = await RankingHistory.distinct("userId", { shopId, month: requestedMonth });
        return res.json({ success: true, ranks: ranksWithPosition, total: totalCount.length, totalUsers: totalCount.length, type });
      }
      query = { shopId, monthlyPeriod: currentMonth };
      sortField = { monthlyPoints: -1 };
    } else if (type === "alltime" && req.query.year) {
      const pipeline = [
        { $match: { shopId, year: req.query.year } },
        {
          $group: {
            _id: "$userId", name: { $last: "$name" }, email: { $last: "$email" },
            avatar: { $last: "$avatar" }, userId: { $first: "$userId" },
            points: { $sum: "$amount" }, updatedAt: { $max: "$createdAt" }
          }
        },
        { $sort: { points: -1 } }, { $limit: limit }
      ];
      const results = await RankingHistory.aggregate(pipeline);
      const ranksWithPosition = results.map((r, idx) => ({ ...r, position: idx + 1 }));
      const totalCount = await RankingHistory.distinct("userId", { shopId, year: req.query.year });
      return res.json({ success: true, ranks: ranksWithPosition, total: totalCount.length, totalUsers: totalCount.length, type });
    }

    const rankings = await Ranking.find(query).sort(sortField).limit(limit).lean();
    const ranksWithPosition = rankings.map((r, idx) => ({ ...r, position: idx + 1 }));

    res.json({
      success: true, ranks: ranksWithPosition,
      total: await Ranking.countDocuments(query),
      totalUsers: await Ranking.countDocuments(query), type
    });
  } catch (error) {
    console.error("Error fetching rankings:", error);
    res.status(500).json({ success: false, message: "Failed to fetch rankings" });
  }
};

// GET /api/rankings/summary
export const getRankingSummary = async (req, res) => {
  try {
    const type = req.query.type || "alltime";
    const today = getThaiDateStr();
    const currentMonth = getThaiMonthStr();

    const shopId = req.query.shopId || req.headers['x-shop-id'] || '';
    let matchQuery = shopId ? { shopId } : {};

    if (type === "daily") {
      matchQuery = { ...matchQuery, date: req.query.date || today };
    } else if (type === "monthly") {
      matchQuery = { ...matchQuery, month: req.query.month || currentMonth };
    } else if (type === "alltime" && req.query.year) {
      matchQuery = { ...matchQuery, year: req.query.year };
    }

    if (Object.keys(matchQuery).length > 0) {
      const result = await RankingHistory.aggregate([
        { $match: matchQuery },
        { $group: { _id: null, totalSum: { $sum: "$amount" }, totalUsers: { $addToSet: "$userId" } } }
      ]);
      const summary = result[0] || { totalSum: 0, totalUsers: [] };
      return res.json({
        success: true, totalSum: summary.totalSum,
        totalUsers: Array.isArray(summary.totalUsers) ? summary.totalUsers.length : 0, type
      });
    }

    const result = await Ranking.aggregate([
      { $group: { _id: null, totalSum: { $sum: "$points" }, totalUsers: { $sum: 1 } } }
    ]);
    const summary = result[0] || { totalSum: 0, totalUsers: 0 };
    res.json({ success: true, totalSum: summary.totalSum, totalUsers: summary.totalUsers, type });
  } catch (error) {
    console.error("Error fetching rankings summary:", error);
    res.status(500).json({ success: false, message: "Failed to fetch summary" });
  }
};

// GET /api/rankings/top
export const getTopRankings = async (req, res) => {
  try {
    const { shopId } = req;
    const type = req.query.type || "alltime";
    const today = getThaiDateStr();
    const currentMonth = getThaiMonthStr();

    let query = { shopId };
    let sortField = { points: -1 };

    if (type === "daily") {
      query.dailyDate = today;
      sortField = { dailyPoints: -1 };
    } else if (type === "monthly") {
      query.monthlyPeriod = currentMonth;
      sortField = { monthlyPoints: -1 };
    }

    const top = await Ranking.find(query).sort(sortField).limit(3).lean();
    res.json({ success: true, ranks: top, totalUsers: await Ranking.countDocuments(query), type });
  } catch (error) {
    console.error("Error fetching rankings:", error);
    res.status(500).json({ success: false, message: "Failed to fetch rankings" });
  }
};

// PUT /api/rankings/update-avatar
export const updateRankingAvatar = async (req, res) => {
  try {
    const { shopId } = req;
    const { userId, email, avatar, username } = req.body;

    if (!userId && !email) {
      return res.status(400).json({ success: false, message: "userId or email is required" });
    }

    let query = { shopId };
    if (userId) query.userId = userId;
    else if (email) query.email = email;

    const ranking = await Ranking.findOne(query);

    if (ranking) {
      if (avatar !== undefined) ranking.avatar = avatar;
      if (username) ranking.name = username;
      await ranking.save();

      const historyUpdate = {};
      if (avatar !== undefined) historyUpdate.avatar = avatar;
      if (username) historyUpdate.name = username;

      if (Object.keys(historyUpdate).length > 0) {
        await RankingHistory.updateMany(query, { $set: historyUpdate });
      }
      console.log(`[Ranking][${shopId}] Avatar updated for user ${ranking.name} (${ranking.userId})`);
      return res.json({ success: true, message: "Avatar updated successfully" });
    } else {
      console.log(`[Ranking][${shopId}] ไม่พบ ranking record สำหรับ user จะสร้างตอนซื้อครั้งแรก`);
      return res.json({ success: true, message: "No ranking record yet, will update on first purchase" });
    }
  } catch (error) {
    console.error("Error updating avatar in ranking:", error);
    res.status(500).json({ success: false, message: "Failed to update avatar" });
  }
};
