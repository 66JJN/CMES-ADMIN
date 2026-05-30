import React, { useContext } from 'react';
import { HomeContext } from '../../contexts/HomeContext';
import { ShopContext } from '../../contexts/ShopContext';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Select from '../ui/Select';
import useDashboardData from '../../hooks/useDashboardData';
import { getTodayStr, getCurrentMonthStr, getCurrentYearStr } from '../../utils/dateHelpers';

// Format helpers
const formatCurrency = (value) => Number(value || 0).toLocaleString("th-TH");

const formatUpdatedAt = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("th-TH", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

/**
 * VipSupporters dashboard component.
 * Renders the right dashboard column including display toggles, rank limit adjustments,
 * calendar filters, statistical aggregates, and actions for VIP privileges & revenue.
 */
export default function VipSupporters({ 
  isCollapsed, 
  onToggleVisibility 
}) {
  const { socket } = useContext(ShopContext);
  const {
    systemOn,
    topRanks,
    rankLoading,
    refreshingRanks,
    rankError,
    rankingType, setRankingType,
    rankLimit, setRankLimit,
    selectedDate, setSelectedDate,
    selectedMonth, setSelectedMonth,
    selectedYear, setSelectedYear,
    rankingSummary,
    publicRankingType,
    setShowIncomeStats,
    setShowPerksModal,
    setShowAllRanks
  } = useContext(HomeContext);

  const { loadTopRanks } = useDashboardData();

  const handleSetPublicRankingType = (type) => {
    if (!socket) return;
    console.log("[Admin] Broadcasting public ranking type:", type);
    socket.emit("setPublicRankingType", { type });
  };

  const handleOpenAllRanks = () => setShowAllRanks(true);
  const handleOpenPerksModal = () => setShowPerksModal(true);

  return (
    <Card 
      type="setting" 
      className={`vip-card ${isCollapsed ? 'card-collapsed' : ''}`}
    >
      <div className="card-drag-handle" title="กดค้างแล้วลากเพื่อย้ายตำแหน่ง">
        <span className="drag-icon">⠿</span>
        <span className="vip-card-title">VIP & Display Control</span>
        <button 
          className="card-eye-btn" 
          onClick={(e) => { e.stopPropagation(); onToggleVisibility(); }} 
          title={isCollapsed ? 'แสดง' : 'ซ่อน'}
        >
          {isCollapsed ? '👁‍🗨' : '👁'}
        </button>
      </div>

      {!isCollapsed && (
        <>
          {/* Public Broadcaster Display Control */}
          <div className="public-broadcast-control">
            <div className="broadcast-header">
              <span className="broadcast-title">📺 Public Display Control</span>
              <span className="broadcast-subtitle">ควบคุมการแสดงผลบนหน้าจอผู้ใช้</span>
            </div>

            <div className="broadcast-buttons">
              <button 
                className={`broadcast-btn ${publicRankingType === "daily" ? "active" : ""}`} 
                onClick={() => handleSetPublicRankingType("daily")} 
                disabled={!systemOn}
              >
                {publicRankingType === "daily" && <span className="live-indicator">🔴 LIVE</span>}
                <span>รายวัน</span>
              </button>
              <button 
                className={`broadcast-btn ${publicRankingType === "monthly" ? "active" : ""}`} 
                onClick={() => handleSetPublicRankingType("monthly")} 
                disabled={!systemOn}
              >
                {publicRankingType === "monthly" && <span className="live-indicator">🔴 LIVE</span>}
                <span>รายเดือน</span>
              </button>
              <button 
                className={`broadcast-btn ${publicRankingType === "alltime" ? "active" : ""}`} 
                onClick={() => handleSetPublicRankingType("alltime")} 
                disabled={!systemOn}
              >
                {publicRankingType === "alltime" && <span className="live-indicator">🔴 LIVE</span>}
                <span>ตลอดกาล</span>
              </button>
            </div>
          </div>

          <div className="section-divider"></div>

          {/* Admin Ranking View filter */}
          <div className="rank-panel-heading">
            <div>
              <p className="rank-panel-title">VIP Supporters (Admin View)</p>
              <small>อันดับ 1-{rankLimit}</small>
            </div>
            <Button 
              variant="secondary" 
              onClick={() => loadTopRanks(topRanks.length > 0)} 
              disabled={refreshingRanks} 
              className="rank-refresh-btn"
            >
              {refreshingRanks ? "รีเฟรช..." : "รีเฟรช"}
            </Button>
          </div>

          <div className="rank-limit-row">
            <label>แสดงจำนวน:</label>
            <input
              type="number"
              min="1"
              max="500"
              value={rankLimit}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 1;
                setRankLimit(Math.max(1, Math.min(500, val)));
              }}
              className="rank-limit-input"
            />
            <span className="rank-limit-label">อันดับ</span>
          </div>

          <div className="ranking-type-selector">
            <button 
              className={`ranking-type-btn ${rankingType === "daily" ? "active" : ""}`} 
              onClick={() => { setRankingType("daily"); setSelectedDate(getTodayStr()); }}
            >
              รายวัน
            </button>
            <button 
              className={`ranking-type-btn ${rankingType === "monthly" ? "active" : ""}`} 
              onClick={() => { setRankingType("monthly"); setSelectedMonth(getCurrentMonthStr()); }}
            >
              รายเดือน
            </button>
            <button 
              className={`ranking-type-btn ${rankingType === "alltime" ? "active" : ""}`} 
              onClick={() => { setRankingType("alltime"); setSelectedYear(getCurrentYearStr()); }}
            >
              ตลอดกาล
            </button>
          </div>

          <div className="rank-date-filter">
            {rankingType === "daily" && (
              <div className="date-picker-row">
                <label>📅 เลือกวันที่:</label>
                <input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)} 
                  max={new Date().toISOString().split('T')[0]} 
                  min={`${new Date().getFullYear()}-01-01`} 
                  className="date-picker-input" 
                />
                {selectedDate && (
                  <button className="clear-filter-btn" onClick={() => setSelectedDate("")}>✕ ล้าง</button>
                )}
              </div>
            )}
            {rankingType === "monthly" && (
              <div className="date-picker-row">
                <label>📅 เลือกเดือน:</label>
                <input 
                  type="month" 
                  value={selectedMonth} 
                  onChange={(e) => setSelectedMonth(e.target.value)} 
                  max={new Date().toISOString().slice(0, 7)} 
                  min={`${new Date().getFullYear()}-01`} 
                  className="date-picker-input" 
                />
                {selectedMonth && (
                  <button className="clear-filter-btn" onClick={() => setSelectedMonth("")}>✕ ล้าง</button>
                )}
              </div>
            )}
            {rankingType === "alltime" && (
              <div className="date-picker-row">
                <label>📅 เลือกปี:</label>
                <Select 
                  value={selectedYear} 
                  onChange={(e) => setSelectedYear(e.target.value)} 
                  options={[
                    { value: '', label: 'ทุกปี' }, 
                    ...Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => ({ value: String(year), label: String(year) }))
                  ]} 
                  className="date-picker-input select-picker-year" 
                />
                {selectedYear && (
                  <button className="clear-filter-btn" onClick={() => setSelectedYear("")}>✕ ล้าง</button>
                )}
              </div>
            )}
          </div>

          <div className="rank-summary-box">
            <div className="summary-item">
              <span className="summary-label">
                {rankingType === "daily" ? "💰 ยอดรวมรายวัน" : rankingType === "monthly" ? "💰 ยอดรวมรายเดือน" : "💰 ยอดรวมตลอดกาล"}
              </span>
              <span className="summary-value">฿{formatCurrency(rankingSummary.totalSum)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">👥 จำนวนผู้สนับสนุน</span>
              <span className="summary-value">{rankingSummary.totalUsers} คน</span>
            </div>
          </div>

          <ul className="rank-list">
            {rankLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <li className="rank-list-item skeleton" key={i}>
                  <div className="rank-index">--</div>
                  <div className="rank-user-info">
                    <div className="placeholder-bar"></div>
                    <div className="placeholder-bar small"></div>
                  </div>
                  <div className="rank-points">--</div>
                </li>
              ))
            ) : topRanks.length === 0 ? (
              <li className="rank-empty">ยังไม่มีข้อมูลอันดับ</li>
            ) : (
              topRanks.map((entry, index) => {
                const pos = entry.position || index + 1;
                let points = entry.points || 0;
                if (rankingType === "daily") points = entry.dailyPoints ?? entry.points ?? 0;
                else if (rankingType === "monthly") points = entry.monthlyPoints ?? entry.points ?? 0;

                return (
                  <li className={`rank-list-item tier-${pos <= 3 ? pos : "default"}`} key={`${entry.name}-${pos}`}>
                    <div className="rank-index">#{pos}</div>
                    <div className="rank-user-info">
                      <strong>{entry.name}</strong>
                      <span>อัปเดต {formatUpdatedAt(entry.updatedAt)}</span>
                    </div>
                    <div className="rank-points">฿{formatCurrency(points)}</div>
                  </li>
                );
              })
            )}
          </ul>

          {rankError && <div className="rank-error">{rankError}</div>}

          <button type="button" className="view-more-ranks" onClick={handleOpenAllRanks}>
            ดูอันดับทั้งหมด
          </button>

          {/* จัดการสิทธิพิเศษ Button */}
          <Button 
            variant="danger" 
            onClick={handleOpenPerksModal} 
            className="manage-perks-btn"
          >
            <span>⚙️</span><span>จัดการสิทธิพิเศษ</span>
          </Button>

          {/* สถิติรายรับ Button */}
          <Button 
            variant="edit" 
            onClick={() => setShowIncomeStats(true)} 
            className="income-stats-btn"
          >
            <span>📈</span> เช็คสถิติรายรับ
          </Button>
        </>
      )}
    </Card>
  );
}
