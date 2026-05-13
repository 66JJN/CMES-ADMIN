/**
 * คอมโพเนนต์สำหรับแสดงประวัติการตรวจสอบทั้งหมด
 * รวมถึงข้อความ รูปภาพ ของขวัญ และวันเกิด
 * ★ Redesigned: unified timeline view, search, filter, pagination, summary
 */
import React, { useEffect, useState, useContext, useCallback } from "react";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "../config/apiConfig";
import adminFetch from "../config/authFetch";
import { ShopContext } from "../contexts/ShopContext";
import "./CheckHistory.css";

// ── Constants ──
const TYPE_LABELS = { all: "ทั้งหมด", image: "รูปภาพ", text: "ข้อความ", gift: "ของขวัญ", birthday: "วันเกิด" };
const TYPE_ICONS = { image: "🖼️", text: "💬", gift: "🎁", birthday: "🎂" };
const ITEMS_PER_PAGE = 50;

function CheckHistory() {
  const { shopId } = useContext(ShopContext);

  // ── State ──
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // ── Filters ──
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // ── Pagination ──
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  // ── Summary ──
  const [summary, setSummary] = useState({ total: 0, totalRevenue: 0, byType: {}, completed: 0, rejected: 0 });

  // ── Fetch ──
  const fetchHistory = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      let url = `${API_BASE_URL}/api/check-history?page=${page}&limit=${ITEMS_PER_PAGE}`;
      if (typeFilter !== "all") url += `&type=${typeFilter}`;
      if (searchQuery.trim()) url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;

      const res = await adminFetch(url);
      const json = await res.json();

      if (json.success) {
        setHistory(json.data || []);
        setPagination(json.pagination || { total: 0, totalPages: 1 });
        setSummary(json.summary || { total: 0, totalRevenue: 0, byType: {}, completed: 0, rejected: 0 });
      } else {
        // Fallback: old API format (array directly)
        if (Array.isArray(json)) {
          setHistory(json);
        }
      }
    } catch (err) {
      console.error("[CheckHistory] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [shopId, page, typeFilter, searchQuery, startDate, endDate]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [typeFilter, searchQuery, startDate, endDate]);

  // ── Delete handlers ──
  const handleDelete = async (id) => {
    if (!window.confirm("ยืนยันการลบรายการนี้?")) return;
    await adminFetch(`${API_BASE_URL}/api/delete-history`, {
      method: "POST",
      body: JSON.stringify({ id }),
    });
    fetchHistory();
  };

  const handleDeleteAll = async () => {
    if (!window.confirm("ยืนยันการลบประวัติทั้งหมด?")) return;
    await adminFetch(`${API_BASE_URL}/api/delete-all-history`, {
      method: "POST"
    });
    fetchHistory();
  };

  // ── Helpers ──
  const getImageUrl = (filePath) => {
    if (!filePath) return null;
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
    return `${API_BASE_URL}${filePath.startsWith('/') ? filePath : `/${filePath}`}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString("th-TH", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const formatShortTime = (dateString) => {
    if (!dateString) return "—";
    const d = new Date(dateString);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("th-TH", { day: "2-digit", month: "short" }) + " " +
      d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  };

  const getStatusLabel = (status) => {
    if (status === "completed") return "เสร็จสิ้น";
    if (status === "approved") return "อนุมัติ";
    return "ปฏิเสธ";
  };

  const fmt = (v) => Number(v || 0).toLocaleString("th-TH");

  // ── Render ──
  return (
    <div className="ch-main-bg">
      {/* Header */}
      <header className="ch-header">
        <Link to="/home" className="back-nav-btn" title="กลับหน้าหลัก">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 19l-7-7 7-7"/></svg>
        </Link>
        <div className="ch-header-center">ประวัติการตรวจสอบ</div>
        <div className="ch-header-actions">
          <button className={`ch-btn ch-btn-edit${editMode ? " active" : ""}`} onClick={() => setEditMode((v) => !v)}>
            {editMode ? "✕ ปิด" : "✏️ แก้ไข"}
          </button>
          {editMode && (
            <button className="ch-btn ch-btn-deleteall" onClick={handleDeleteAll}>
              <i className="fas fa-trash-can"></i> ลบทั้งหมด
            </button>
          )}
        </div>
      </header>

      <div className="ch-container">
        {/* Summary Bar */}
        <div className="ch-summary-bar">
          <div className="ch-summary-card primary">
            <div className="ch-summary-label">รายการทั้งหมด</div>
            <div className="ch-summary-value">{fmt(summary.total)}</div>
          </div>
          <div className="ch-summary-card revenue">
            <div className="ch-summary-label">รายรับรวม</div>
            <div className="ch-summary-value">฿{fmt(summary.totalRevenue)}</div>
          </div>
          <div className="ch-summary-card">
            <div className="ch-summary-label">เสร็จสิ้น</div>
            <div className="ch-summary-value" style={{ color: "var(--success-600)" }}>{fmt(summary.completed)}</div>
          </div>
          <div className="ch-summary-card">
            <div className="ch-summary-label">ปฏิเสธ</div>
            <div className="ch-summary-value" style={{ color: "var(--danger-500)" }}>{fmt(summary.rejected)}</div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="ch-filter-bar">
          <div className="ch-type-tabs">
            {Object.entries(TYPE_LABELS).map(([key, label]) => (
              <button key={key} className={`ch-type-tab${typeFilter === key ? " active" : ""}`} onClick={() => setTypeFilter(key)}>
                {key !== "all" && TYPE_ICONS[key]} {label}
                {key !== "all" && summary.byType?.[key] > 0 && <span className="badge">{summary.byType[key]}</span>}
              </button>
            ))}
          </div>

          <div className="ch-search-wrap">
            <svg className="ch-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="ch-search-input" type="text" placeholder="ค้นหาผู้ส่ง..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>

          <div className="ch-date-group">
            <input className="ch-date-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} title="วันเริ่มต้น" />
            <span className="ch-date-sep">ถึง</span>
            <input className="ch-date-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} title="วันสิ้นสุด" />
          </div>
        </div>

        {/* Table */}
        <div className="ch-table-wrap">
          {/* Table Header */}
          <div className="ch-table-header">
            <div>ประเภท</div>
            <div>รายละเอียด</div>
            <div>เวลา</div>
            <div>จำนวน</div>
            <div>สถานะ</div>
            <div></div>
          </div>

          {/* Loading skeleton */}
          {loading && Array.from({ length: 6 }).map((_, i) => (
            <div className="ch-skeleton-row" key={i}>
              <div className="ch-skeleton" style={{ width: 72, height: 26 }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div className="ch-skeleton" style={{ width: "60%", height: 14 }} />
                <div className="ch-skeleton" style={{ width: "40%", height: 12 }} />
              </div>
              <div className="ch-skeleton" style={{ width: 80, height: 14 }} />
              <div className="ch-skeleton" style={{ width: 56, height: 14 }} />
              <div className="ch-skeleton" style={{ width: 64, height: 24 }} />
            </div>
          ))}

          {/* Empty State */}
          {!loading && history.length === 0 && (
            <div className="ch-empty">
              <div className="ch-empty-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/>
                </svg>
              </div>
              <h3>ไม่พบข้อมูลประวัติ</h3>
              <p>ลองปรับตัวกรองหรือช่วงเวลา หรือรอจนกว่าจะมีรายการใหม่</p>
            </div>
          )}

          {/* Data Rows */}
          {!loading && history.map((item, idx) => (
            <div
              className="ch-row"
              key={item.id}
              style={{ animationDelay: `${idx * 0.03}s` }}
              onClick={() => { setSelected(item); setShowModal(true); }}
            >
              {/* Type Badge */}
              <div>
                <span className={`ch-type-badge ${item.type || "text"}`}>
                  {TYPE_ICONS[item.type] || "📄"} {TYPE_LABELS[item.type] || item.type}
                </span>
              </div>

              {/* Detail */}
              <div className="ch-row-detail" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {item.filePath && (
                  <img className="ch-row-thumb" src={getImageUrl(item.filePath)} alt="" onError={(e) => { e.target.style.display = "none"; }} />
                )}
                <div style={{ minWidth: 0 }}>
                  <div className="ch-row-sender">{item.sender || "ไม่ระบุ"}</div>
                  <div className="ch-row-text">{item.text || (item.giftItems?.length ? `${item.giftItems.length} รายการ` : "—")}</div>
                </div>
              </div>

              {/* Time */}
              <div className="ch-row-time">{formatShortTime(item.checkedAt || item.createdAt)}</div>

              {/* Amount */}
              <div className={`ch-row-amount ${item.price > 0 ? "paid" : "free"}`}>
                {item.price > 0 ? `฿${fmt(item.price)}` : "ฟรี"}
              </div>

              {/* Status */}
              <div>
                <span className={`ch-status-badge ${item.status}`}>{getStatusLabel(item.status)}</span>
              </div>

              {/* Delete */}
              <div>
                {editMode && (
                  <button className="ch-row-delete" onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} title="ลบ">
                    <i className="fas fa-trash-can"></i>
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Pagination */}
          {!loading && pagination.totalPages > 1 && (
            <div className="ch-pagination">
              <button className="ch-page-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← ก่อนหน้า</button>
              <span className="ch-page-info">หน้า {page} / {pagination.totalPages} ({pagination.total} รายการ)</span>
              <button className="ch-page-btn" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>ถัดไป →</button>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {showModal && selected && (
        <div className="ch-modal-bg" onClick={() => setShowModal(false)}>
          <div className="ch-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="ch-modal-header">
              <h2>
                <span className={`ch-type-badge ${selected.type || "text"}`} style={{ marginRight: 8 }}>
                  {TYPE_ICONS[selected.type] || "📄"} {TYPE_LABELS[selected.type] || selected.type}
                </span>
                รายละเอียด
              </h2>
              <button className="ch-modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="ch-modal-body">
              {selected.sender && (
                <div className="ch-modal-field"><b>ผู้ส่ง</b>{selected.sender}</div>
              )}
              {selected.text && (
                <div className="ch-modal-field"><b>เนื้อหา</b>{selected.text}</div>
              )}
              {selected.note && (
                <div className="ch-modal-field"><b>โน้ตเพิ่มเติม</b>{selected.note}</div>
              )}
              {selected.filePath && (
                <div className="ch-modal-field">
                  <b>รูปภาพ</b>
                  <img className="ch-modal-image" src={getImageUrl(selected.filePath)} alt="img"
                    onError={(e) => { e.target.style.display = "none"; }} />
                </div>
              )}
              {selected.giftItems && selected.giftItems.length > 0 && (
                <div className="ch-modal-field">
                  <b>รายการของขวัญ</b>
                  <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
                    {selected.giftItems.map((g, i) => (
                      <li key={i} style={{ marginBottom: 2 }}>{g.name} ×{g.quantity}</li>
                    ))}
                  </ul>
                </div>
              )}
              {selected.tableNumber > 0 && (
                <div className="ch-modal-field"><b>โต๊ะ</b>{selected.tableNumber}</div>
              )}
              <div className="ch-modal-field">
                <b>ราคา</b>
                <span style={{ color: selected.price > 0 ? "var(--success-600)" : "var(--gray-400)", fontWeight: 700 }}>
                  {selected.price > 0 ? `฿${fmt(selected.price)}` : "ฟรี"}
                </span>
              </div>
              <div className="ch-modal-field">
                <b>สถานะ</b>
                <span className={`ch-status-badge ${selected.status}`}>{getStatusLabel(selected.status)}</span>
              </div>
              {selected.social && selected.social.type && (
                <div className="ch-modal-field"><b>Social</b>{selected.social.type} ({selected.social.name})</div>
              )}

              {/* Timeline */}
              <div className="ch-modal-timeline">
                {selected.createdAt && (
                  <div className="ch-modal-timeline-item"><div className="dot"/><span>รับข้อมูล: {formatDate(selected.createdAt)}</span></div>
                )}
                {selected.checkedAt && (
                  <div className="ch-modal-timeline-item"><div className="dot"/><span>ตรวจสอบ: {formatDate(selected.checkedAt)}</span></div>
                )}
                {selected.startedAt && (
                  <div className="ch-modal-timeline-item"><div className="dot"/><span>เริ่มแสดง: {formatDate(selected.startedAt)}</span></div>
                )}
                {selected.endedAt && (
                  <div className="ch-modal-timeline-item"><div className="dot"/><span>จบการแสดง: {formatDate(selected.endedAt)}</span></div>
                )}
                {selected.duration && (
                  <div className="ch-modal-timeline-item"><div className="dot"/><span>ระยะเวลา: {selected.duration} วินาที</span></div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CheckHistory;
