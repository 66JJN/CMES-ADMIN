import React, { useState, useEffect, useCallback, useContext } from "react";
import { API_BASE_URL } from "../config/apiConfig";
import adminFetch from "../config/authFetch";
import { ShopContext } from "../contexts/ShopContext";
import { getTodayStr } from "../utils/dateHelpers";
import "./IncomeStats.css";

// ฟังก์ชันจัดรูปแบบตัวเลขเป็นสกุลเงินไทย
const fmt = (v) => Number(v || 0).toLocaleString("th-TH");

// ฟังก์ชันย่อวันที่เป็น DD/MM
const shortDate = (d) => {
  const [, m, dd] = d.split("-");
  return `${dd}/${m}`;
};

// ฟังก์ชันแปลง Date เป็น YYYY-MM-DD ในรูปแบบ local time
const formatDateStr = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// ฟังก์ชันคำนวณวันเริ่มต้นและสิ้นสุดตามประเภท Preset โดยใช้เวลาไทย (getTodayStr)
const calculateDatesForPreset = (preset) => {
  const todayStr = getTodayStr(); // YYYY-MM-DD จาก Asia/Bangkok
  const [year, month, day] = todayStr.split("-").map(Number);
  
  const end = new Date(year, month - 1, day);
  let start = new Date(year, month - 1, day);

  if (preset === "today") {
    // start matches end
  } else if (preset === "this_week") {
    const dayOfWeek = end.getDay();
    const diff = end.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // เริ่มจันทร์
    start = new Date(year, month - 1, diff);
  } else if (preset === "this_month") {
    start = new Date(year, month - 1, 1);
  } else if (preset === "this_year") {
    start = new Date(year, 0, 1);
  } else if (preset === "all_time") {
    start = new Date(year - 5, 0, 1);
  } else {
    return null;
  }

  return {
    startDate: formatDateStr(start),
    endDate: formatDateStr(end)
  };
};

// สีสำหรับ Top spenders
const SPENDER_COLORS = ["#4f46e5", "#6d28d9", "#7c3aed", "#8b5cf6", "#a78bfa"];
const PEAK_COLORS = ["#4f46e5", "#6d28d9", "#7c3aed"];

/**
 * IncomeStats — Modal สถิติรายรับและกิจกรรม
 * 🔥 ดึงข้อมูลสดจาก MongoDB ทุกครั้งที่เปิด (ไม่ cache)
 */
function IncomeStats({ show, onClose }) {
  const { socket } = useContext(ShopContext);

  // ===== LocalStorage persistence =====
  const getInitialDates = () => {
    try {
      const saved = localStorage.getItem('adminIncomeStats');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Migrate old presets
        if (parsed.activePreset === '30_days' || parsed.activePreset === '7_days') {
          parsed.activePreset = 'this_week';
        }

        // หากเป็น dynamic preset ให้คำนวณใหม่ทุกครั้งที่เปิด/โหลด เพื่อเลี่ยงข้อมูลค้างจากอดีต
        if (parsed.activePreset && parsed.activePreset !== 'custom') {
          const recalculated = calculateDatesForPreset(parsed.activePreset);
          if (recalculated) {
            return {
              startDate: recalculated.startDate,
              endDate: recalculated.endDate,
              activePreset: parsed.activePreset
            };
          }
        }
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse adminIncomeStats from localStorage');
    }
    // Default to this week
    const calculated = calculateDatesForPreset('this_week');
    return {
      startDate: calculated.startDate,
      endDate: calculated.endDate,
      activePreset: 'this_week'
    };
  };

  const initial = getInitialDates();
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [activePreset, setActivePreset] = useState(initial.activePreset || '');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ป้องกันการอัปเดตแบบ infinite loop: บันทึกเฉพาะเมื่อเปลี่ยนด้วยมือ ไม่ใช่ตอน render
  useEffect(() => {
    localStorage.setItem('adminIncomeStats', JSON.stringify({ startDate, endDate, activePreset }));
  }, [startDate, endDate, activePreset]);

  // ===== Fetch สถิติจาก API (ไม่ cache) =====
  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await adminFetch(
        `${API_BASE_URL}/api/admin/income-stats?startDate=${startDate}&endDate=${endDate}&_t=${Date.now()}`
      );
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      } else {
        setError(data.message || "ไม่สามารถโหลดข้อมูลได้");
      }
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  // ===== BUG FIX: ล้าง state เก่าทุกครั้งที่เปิด Modal + fetch ใหม่ =====
  useEffect(() => {
    if (show) {
      setStats(null); // ล้างข้อมูลเก่าเพื่อป้องกัน stale data
      fetchStats();
    }
  }, [show, startDate, endDate, fetchStats]);

  // ===== Real-time updates via Socket.IO =====
  useEffect(() => {
    if (!socket || !show) return;
    const handleUpdate = () => {
      fetchStats();
    };
    socket.on("admin-update-queue", handleUpdate);
    socket.on("ranking-update", handleUpdate);
    return () => {
      socket.off("admin-update-queue", handleUpdate);
      socket.off("ranking-update", handleUpdate);
    };
  }, [socket, show, fetchStats]);

  if (!show) return null;

  // ===== Quick date preset helpers =====
  const handlePreset = (type) => {
    if (type === 'custom') {
      setActivePreset('custom');
      return;
    }

    const calculated = calculateDatesForPreset(type);
    if (calculated) {
      setStartDate(calculated.startDate);
      setEndDate(calculated.endDate);
      setActivePreset(type);
    }
  };

  const handleCustomDateChange = (isStart, value) => {
    setActivePreset('custom');
    if (isStart) setStartDate(value);
    else setEndDate(value);
  };

  // ===== Check if data is completely empty =====
  const isEmpty = stats && stats.totalOrders === 0 && stats.totalIncome === 0;

  return (
    <div className="income-overlay" onClick={onClose}>
      <div className="income-modal" onClick={(e) => e.stopPropagation()}>
        {/* ── Header ── */}
        <div className="income-header">
          <div className="income-header-top">
            <div>
              <div className="income-header-title">
                <div className="header-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" />
                  </svg>
                </div>
                <h2>สถิติรายรับและกิจกรรม</h2>
              </div>
              <p className="income-header-sub">ตรวจสอบยอดรายรับ กิจกรรม และช่วงเวลาที่มีการใช้งานสูงสุด</p>
            </div>
            <button className="income-close-btn" onClick={onClose}>✕</button>
          </div>

          {/* Date range + presets */}
          <div className="income-date-row">
            <div className="income-date-group">
              <label className="income-date-label">📅 เริ่มต้นที่</label>
              <input type="date" className="income-date-input" value={startDate} onChange={(e) => handleCustomDateChange(true, e.target.value)} />
            </div>
            <div className="income-date-group">
              <label className="income-date-label">📅 ถึงวันที่</label>
              <input type="date" className="income-date-input" value={endDate} onChange={(e) => handleCustomDateChange(false, e.target.value)} />
            </div>
            <div className="income-date-group">
              <label className="income-date-label">⌛ ช่วงเวลา</label>
              <select
                className="income-date-input"
                value={activePreset}
                onChange={(e) => handlePreset(e.target.value)}
              >
                <option value="today">วันนี้</option>
                <option value="this_week">สัปดาห์นี้</option>
                <option value="this_month">เดือนนี้</option>
                <option value="this_year">ปีนี้</option>
                <option value="all_time">ตลอดกาล</option>
                <option value="custom" disabled hidden>กำหนดเอง</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="income-body">
          {/* Loading skeleton */}
          {loading && <SkeletonLoader />}

          {/* Error */}
          {!loading && error && (
            <div className="income-error">⚠️ {error}</div>
          )}

          {/* Empty state */}
          {!loading && !error && isEmpty && <EmptyState />}

          {/* Real data */}
          {!loading && !error && stats && !isEmpty && (
            <StatsContent stats={stats} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Sub-components
   ============================================================ */

// ── Skeleton Loading ──
function SkeletonLoader() {
  const Bone = ({ w = "100%", h = 14, r = 8, mb = 0 }) => (
    <div className="income-skeleton" style={{ width: w, height: h, borderRadius: r, marginBottom: mb }} />
  );
  return (
    <>
      <div className="income-skeleton-grid">
        <div className="income-skeleton-card span-2"><Bone h={16} w="40%" mb={10} /><Bone h={32} w="60%" mb={8} /><Bone h={20} w="35%" /></div>
        <div className="income-skeleton-card span-2"><Bone h={14} w="50%" mb={10} /><Bone h={28} w="70%" mb={12} /><Bone h={8} w="90%" mb={8} /><Bone h={12} w="40%" /></div>
        <div className="income-skeleton-card span-2"><Bone h={14} w="50%" mb={10} /><Bone h={28} w="50%" mb={10} /><Bone h={14} w="40%" /></div>
        <div className="income-skeleton-card span-2"><Bone h={14} w="50%" mb={10} /><Bone h={28} w="50%" mb={10} /><Bone h={14} w="40%" /></div>
      </div>
      <div className="income-skeleton-charts">
        <div className="income-skeleton-card"><Bone h={14} w="30%" mb={14} /><Bone h={120} /></div>
        <div className="income-skeleton-card"><Bone h={14} w="35%" mb={14} /><Bone h={120} /></div>
      </div>
      <div className="income-skeleton-bottom">
        <div className="income-skeleton-card"><Bone h={14} w="35%" mb={12} /><Bone h={40} mb={8} /><Bone h={40} mb={8} /><Bone h={40} /></div>
        <div className="income-skeleton-card"><Bone h={14} w="40%" mb={12} /><Bone h={50} mb={8} /><Bone h={50} mb={8} /><Bone h={50} /></div>
      </div>
    </>
  );
}

// ── Empty State ──
function EmptyState() {
  return (
    <div className="income-empty">
      <div className="income-empty-icon">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" />
        </svg>
      </div>
      <h3>ยังไม่มีข้อมูลในช่วงเวลานี้</h3>
      <p>ลองเลือกช่วงเวลาอื่น หรือรอจนกว่าจะมีรายการใหม่เข้ามาในระบบ</p>
    </div>
  );
}

// ── Main Stats Content ──
function StatsContent({ stats }) {
  const {
    totalIncome = 0,
    totalUsers = 0,
    totalOrders = 0, // เฉพาะจ่ายเงิน
    freeOrders = 0,
    totalAllOrders = 0,
    growthPct,
    peakHours = [],
    topUsers = [],
    peakDay,
    dailyTrend = [],
    activities = []
  } = stats;

  const avgPerUser = totalUsers > 0 ? Math.round(totalIncome / totalUsers) : 0;

  // Growth badge
  const growthClass = growthPct > 0 ? "positive" : growthPct < 0 ? "negative" : "neutral";
  const growthIcon = growthPct > 0 ? "↑" : growthPct < 0 ? "↓" : "→";
  const growthText = growthPct != null ? `${growthPct > 0 ? "+" : ""}${growthPct}%` : "—";

  // Calculate percentage splits safely
  const paidPct = totalAllOrders > 0 ? Math.round((totalOrders / totalAllOrders) * 100) : 0;
  const freePct = totalAllOrders > 0 ? Math.round((freeOrders / totalAllOrders) * 100) : 0;

  return (
    <>
      {/* ── ROW 1: KPI Cards ── */}
      <div className="income-kpi-grid">
        {/* รายรับรวม (featured) */}
        <div className="income-kpi-card featured span-2">
          <div className="income-kpi-icon" style={{ background: "rgba(255,255,255,0.15)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div className="kpi-label">รายรับรวม</div>
          <div className="kpi-value">฿{fmt(totalIncome)}</div>
          <span className={`kpi-growth ${growthClass}`}>
            {growthIcon} {growthText} <span style={{ fontWeight: 400, opacity: 0.7, marginLeft: 4, fontSize: "10.5px" }}>จากช่วงก่อน</span>
          </span>
        </div>

        {/* รายการเข้าร่วมทั้งหมด (split paid & free) */}
        <div className="income-kpi-card split-card span-2">
          <div className="income-kpi-icon" style={{ background: "linear-gradient(135deg, #c7d2fe, #a5b4fc)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </div>
          <div className="kpi-label">รายการเข้าร่วมทั้งหมด</div>
          <div className="kpi-value" style={{ color: "var(--primary-700, #4338ca)" }}>
            {totalAllOrders.toLocaleString("th-TH")} <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--gray-500)" }}>รายการ</span>
          </div>

          <div className="income-split-container">
            <div className="income-split-bar-wrapper">
              <div className="income-split-bar">
                <div
                  className="income-split-fill paid"
                  style={{ width: `${paidPct}%` }}
                  title={`สนับสนุน (จ่ายเงิน): ${totalOrders} รายการ (${paidPct}%)`}
                />
                <div
                  className="income-split-fill free"
                  style={{ width: `${freePct}%` }}
                  title={`ร่วมกิจกรรม (ฟรี): ${freeOrders} รายการ (${freePct}%)`}
                />
              </div>
            </div>
            <div className="income-split-details">
              <div className="income-split-detail-item">
                <div className="dot paid" />
                <span className="label">เปรียบเสมือนเปย์:</span>
                <span className="value">{totalOrders} บิล ({paidPct}%)</span>
              </div>
              <div className="income-split-detail-item">
                <div className="dot free" />
                <span className="label">ร่วมสนุกฟรี:</span>
                <span className="value">{freeOrders} บิล ({freePct}%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* ยอดเฉลี่ย/คน */}
        <div className="income-kpi-card span-2">
          <div className="income-kpi-icon" style={{ background: "linear-gradient(135deg, #ddd6fe, #c4b5fd)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6d28d9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div className="kpi-label">ยอดเฉลี่ยต่อผู้สนับสนุน</div>
          <div className="kpi-value">฿{fmt(avgPerUser)}</div>
          <span style={{ fontSize: "11px", color: "var(--gray-400)", fontWeight: 500 }}>เฉลี่ยต่อยอดเปย์สะสมของผู้สนับสนุนแต่ละคน</span>
        </div>

        {/* ผู้สนับสนุน */}
        <div className="income-kpi-card span-2">
          <div className="income-kpi-icon" style={{ background: "linear-gradient(135deg, #bbf7d0, #86efac)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="kpi-label">ผู้สนับสนุนผู้ใจดี</div>
          <div className="kpi-value" style={{ color: "var(--success-600)" }}>{totalUsers.toLocaleString("th-TH")} <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--gray-500)" }}>คน</span></div>
          <span style={{ fontSize: "11px", color: "var(--gray-400)", fontWeight: 500 }}>จำนวนผู้เปย์สนับสนุนทั้งหมดที่ไม่ซ้ำกัน</span>
        </div>
      </div>

      {/* ── ROW 2: Charts ── */}
      <div className="income-charts-grid">
        <RevenueChart data={dailyTrend} />
        <ActivityDonut activities={activities} />
      </div>

      {/* ── ROW 3: Leaderboard + Peak ── */}
      <div className="income-bottom-grid">
        <TopSpenders users={topUsers} />
        <PeakHoursCard hours={peakHours} day={peakDay} />
      </div>
    </>
  );
}

// ── Revenue Trend Chart ──
function RevenueChart({ data }) {
  if (!data || data.length < 2) {
    return (
      <div className="income-chart-card">
        <div className="income-chart-header">
          <div className="income-chart-title"><div className="dot" style={{ background: "#4f46e5" }} /><span>แนวโน้มรายรับ</span></div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 140, color: "#9ca3af", fontSize: 13, gap: 8 }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" strokeWidth="1.5"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" /></svg>
          ยังไม่มีข้อมูลเพียงพอสำหรับกราฟ
        </div>
      </div>
    );
  }

  const cW = 380, cH = 140, padL = 42, padR = 8, padT = 8, padB = 24;
  const chartW = cW - padL - padR, chartH = cH - padT - padB;
  const vals = data.map((d) => d.amount || 0);
  const hi = Math.max(...vals, 1);

  const pts = vals.map((v, i) => {
    const x = padL + (i / (vals.length - 1)) * chartW;
    const y = padT + chartH - (v / hi) * chartH;
    return [x, y];
  });

  const lineStr = pts.map(([x, y]) => `${x},${y}`).join(" ");
  const areaStr = `${padL},${padT + chartH} ` + lineStr + ` ${padL + chartW},${padT + chartH}`;

  // Y-axis ticks
  const yTicks = [0, Math.round(hi / 2), hi];

  return (
    <div className="income-chart-card">
      <div className="income-chart-header">
        <div className="income-chart-title"><div className="dot" style={{ background: "#4f46e5" }} /><span>แนวโน้มรายรับ</span></div>
        <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>{data.length} วัน</span>
      </div>
      <div className="income-revenue-chart">
        <svg viewBox={`0 0 ${cW} ${cH}`} style={{ height: 140 }}>
          <defs>
            <linearGradient id="incAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Grid lines */}
          {yTicks.map((tick, i) => {
            const y = padT + chartH - (tick / hi) * chartH;
            return <line key={i} x1={padL} y1={y} x2={padL + chartW} y2={y} stroke="#e5e7eb" strokeWidth="1" strokeDasharray={i > 0 ? "4 3" : "0"} />;
          })}
          {/* Y labels */}
          {yTicks.map((tick, i) => {
            const y = padT + chartH - (tick / hi) * chartH;
            return <text key={i} x={padL - 6} y={y + 3.5} textAnchor="end" fontSize="9" fill="#9ca3af" fontWeight="500">฿{fmt(tick)}</text>;
          })}
          {/* Area */}
          <polygon points={areaStr} fill="url(#incAreaGrad)" />
          {/* Line */}
          <polyline points={lineStr} fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {/* Dots */}
          {pts.map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="4" fill="#fff" stroke="#4f46e5" strokeWidth="2" />
              <title>{data[i].date}: ฿{fmt(vals[i])}</title>
            </g>
          ))}
        </svg>
        {/* X-axis labels */}
        <div className="income-chart-labels">
          {data.filter((_, i) => i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2)).map((d, i) => (
            <span key={i}>{shortDate(d.date)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Activity Donut Chart ──
function ActivityDonut({ activities }) {
  const R = 52, CX = 70, CY = 70;
  const circ = 2 * Math.PI * R;
  let offset = 0;
  const segs = activities.map((a) => {
    const dash = (a.pct / 100) * circ;
    const seg = { ...a, dash, gap: circ - dash, offset };
    offset += dash;
    return seg;
  });

  return (
    <div className="income-chart-card">
      <div className="income-chart-header">
        <div className="income-chart-title"><div className="dot" style={{ background: "#6d28d9" }} /><span>สัดส่วนกิจกรรม</span></div>
      </div>
      {activities.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 120, color: "#9ca3af", fontSize: 13, gap: 8 }}>
          <span style={{ fontSize: 28 }}>📊</span>ยังไม่มีข้อมูล
        </div>
      ) : (
        <div className="income-donut-wrap">
          <svg viewBox="0 0 140 140" width="120" height="120" style={{ flexShrink: 0, transform: "rotate(-90deg)" }}>
            {segs.map((seg, i) => (
              <circle key={i} cx={CX} cy={CY} r={R} fill="none" stroke={seg.color} strokeWidth="22"
                strokeDasharray={`${seg.dash} ${seg.gap}`} strokeDashoffset={-seg.offset}
                style={{ transition: "stroke-dasharray 0.6s ease, stroke-dashoffset 0.6s ease" }}
              />
            ))}
            <circle cx={CX} cy={CY} r="32" fill="#fff" />
          </svg>
          <div className="income-donut-legend">
            {activities.map((a, i) => (
              <div key={i} className="income-donut-legend-item">
                <div className="dot" style={{ background: a.color }} />
                <span className="label">{a.label}</span>
                <span className="pct" style={{ color: a.color }}>{a.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Top Spenders ──
function TopSpenders({ users }) {
  return (
    <div className="income-bottom-card">
      <div className="income-bottom-header"><span className="icon">👑</span><span>สายเปย์ตัวท็อป</span></div>
      {users.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 0", color: "#9ca3af", fontSize: 13, gap: 8 }}>
          <span style={{ fontSize: 28 }}>👤</span>ยังไม่มีข้อมูลผู้สนับสนุน
        </div>
      ) : (
        users.slice(0, 5).map((u, idx) => {
          const medals = ["🥇", "🥈", "🥉"];
          const maxAmt = users[0]?.totalAmount || 1;
          const barPct = Math.round(((u.totalAmount || 0) / maxAmt) * 100);
          return (
            <div key={idx} className="income-spender-row">
              <div className="income-spender-avatar" style={{ background: `linear-gradient(135deg, ${SPENDER_COLORS[idx] || "#a78bfa"}, ${SPENDER_COLORS[Math.min(idx + 1, 4)]})` }}>
                {(u.name || "?").slice(0, 2)}
              </div>
              <div className="income-spender-info">
                <div className="income-spender-name">
                  <span className="name">{medals[idx] || `#${idx + 1}`} {u.name || "ผู้ใช้"}</span>
                  <span className="amount">฿{fmt(u.totalAmount)}</span>
                </div>
                <div className="income-spender-bar">
                  <div className="income-spender-bar-fill" style={{ width: `${barPct}%`, background: SPENDER_COLORS[idx] || "#a78bfa" }} />
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Peak Hours ──
function PeakHoursCard({ hours, day }) {
  return (
    <div className="income-bottom-card">
      <div className="income-bottom-header"><span className="icon">🔥</span><span>เวลาและวันที่คนเยอะสุด</span></div>
      {hours.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0", color: "#9ca3af", fontSize: 13, gap: 8 }}>
          <span style={{ fontSize: 24 }}>🕐</span>ยังไม่มีข้อมูล
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {hours.slice(0, 3).map((ph, idx) => {
            const maxC = hours[0]?.count || 1;
            const pct = Math.round((ph.count / maxC) * 100);
            return (
              <div key={idx} className="income-peak-row">
                <div className="income-peak-top">
                  <div className="income-peak-left">
                    <div className="income-peak-badge" style={{ background: PEAK_COLORS[idx] }}>{idx + 1}</div>
                    <span className="income-peak-hour">{ph.hour}</span>
                  </div>
                  <span className="income-peak-count">{ph.count} บิล</span>
                </div>
                <div className="income-peak-bar">
                  <div className="income-peak-bar-fill" style={{ width: `${pct}%`, background: PEAK_COLORS[idx] }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Busiest day */}
      <div className="income-peak-day">
        <div className="income-peak-day-icon">📅</div>
        <div>
          <div className="income-peak-day-label">วันที่คนเยอะที่สุด</div>
          <div className="income-peak-day-value">{day || "ยังไม่มีข้อมูล"}</div>
        </div>
      </div>
    </div>
  );
}

export default IncomeStats;
