/**
 * Income Controller — Business Logic สำหรับจัดการสถิติรายรับ
 */
import CheckHistory from '../models/CheckHistory.js';
import ImageQueue from '../models/ImageQueue.js';

// GET /api/admin/income-stats
export const getIncomeStats = async (req, res) => {
  try {
    const { shopId } = req;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: "Missing startDate or endDate" });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const [historyRecords, queueRecords] = await Promise.all([
      CheckHistory.find({
        shopId, createdAt: { $gte: start, $lte: end },
        status: { $in: ["completed", "rejected"] }
      }).lean(),
      ImageQueue.find({
        shopId, receivedAt: { $gte: start, $lte: end }
      }).lean()
    ]);

    const records = [
      ...historyRecords.map(r => ({ ...r, _source: 'history', _dateField: r.createdAt })),
      ...queueRecords.map(r => ({ ...r, sender: r.sender || 'Unknown', _source: 'queue', _dateField: r.receivedAt || r.createdAt }))
    ];

    let totalIncome = 0;
    const userSet = new Set();
    const hourCounts = {};
    const dayCounts = {};
    const dailyMap = {};
    const typeMap = {};
    const userAmtMap = {};

    const TH_OFFSET = 7 * 60 * 60 * 1000;
    const DAY_NAMES = ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัส","ศุกร์","เสาร์"];
    const TYPE_LABELS = { image: "รูปภาพ", text: "ข้อความ", gift: "ส่งของขวัญ", birthday: "วันเกิด" };
    const TYPE_COLORS = { image: "#6d28d9", text: "#4f46e5", gift: "#7c3aed", birthday: "#a78bfa" };

    records.forEach(r => {
      const price = r.price || 0;
      totalIncome += price;

      const uKey = (r.userId && r.userId !== "guest" && r.userId !== "unknown")
        ? r.userId : `guest_${r.sender || "unknown"}`;
      userSet.add(uKey);

      if (!userAmtMap[uKey]) userAmtMap[uKey] = { name: r.sender || "ผู้ใช้", amount: 0 };
      userAmtMap[uKey].amount += price;

      const t = r.type || (r.filePath ? 'image' : 'other');
      typeMap[t] = (typeMap[t] || 0) + 1;

      const dateField = r._dateField;
      if (dateField) {
        const localTime = new Date(new Date(dateField).getTime() + TH_OFFSET);
        const hour = localTime.getUTCHours().toString().padStart(2, "0");
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;

        const dow = localTime.getUTCDay();
        dayCounts[dow] = (dayCounts[dow] || 0) + 1;

        const y = localTime.getUTCFullYear();
        const m = String(localTime.getUTCMonth() + 1).padStart(2, "0");
        const d = String(localTime.getUTCDate()).padStart(2, "0");
        const dateKey = `${y}-${m}-${d}`;
        dailyMap[dateKey] = (dailyMap[dateKey] || 0) + price;
      }
    });

    const peakHours = Object.entries(hourCounts)
      .map(([hour, count]) => ({ hour: `${hour}:00`, count }))
      .sort((a, b) => b.count - a.count).slice(0, 3);

    const peakDayEntry = Object.entries(dayCounts).sort(([, a], [, b]) => b - a)[0];
    const peakDay = peakDayEntry ? `วัน${DAY_NAMES[parseInt(peakDayEntry[0])]}` : null;

    const dailyTrend = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({ date, amount }));

    const totalRecords = records.length || 1;
    const activities = Object.entries(typeMap)
      .sort(([, a], [, b]) => b - a)
      .map(([type, count]) => ({
        label: TYPE_LABELS[type] || type,
        pct: Math.round((count / totalRecords) * 100),
        color: TYPE_COLORS[type] || "#94a3b8"
      }));
    if (activities.length > 0) {
      const sumPct = activities.reduce((s, a) => s + a.pct, 0);
      activities[activities.length - 1].pct += (100 - sumPct);
    }

    const topUsers = Object.values(userAmtMap)
      .sort((a, b) => b.amount - a.amount).slice(0, 5)
      .map(u => ({ name: u.name, totalAmount: u.amount }));

    // Growth % calculation
    const periodMs = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 1);
    prevEnd.setHours(23, 59, 59, 999);
    const prevStart = new Date(prevEnd.getTime() - periodMs);

    let growthPct = null;
    try {
      const [prevHistoryRecords, prevQueueRecords] = await Promise.all([
        CheckHistory.find({
          shopId, createdAt: { $gte: prevStart, $lte: prevEnd },
          status: { $in: ["completed", "rejected"] }
        }).lean(),
        ImageQueue.find({
          shopId, receivedAt: { $gte: prevStart, $lte: prevEnd }
        }).lean()
      ]);
      const prevIncome = [...prevHistoryRecords, ...prevQueueRecords].reduce((sum, r) => sum + (r.price || 0), 0);
      if (prevIncome > 0) {
        growthPct = Math.round(((totalIncome - prevIncome) / prevIncome) * 100 * 10) / 10;
      } else if (totalIncome > 0) {
        growthPct = 100;
      } else {
        growthPct = 0;
      }
    } catch (growthErr) {
      console.warn("[IncomeStats] Growth calc error:", growthErr.message);
    }

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.json({
      success: true,
      data: { totalIncome, totalUsers: userSet.size, totalOrders: records.length, growthPct, peakHours, peakDay, dailyTrend, activities, topUsers }
    });
  } catch (error) {
    console.error("Error fetching income stats:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
