/**
 * AdminReport — Presentational Component สำหรับศูนย์ติดตามปัญหา
 * แยก Logic ออกไปไว้ที่ hooks/useAdminReport.js
 */
import React from "react";
import { Link } from "react-router-dom";
import useAdminReport from "../../hooks/useAdminReport";
import "./DashboardShared.css";
import "./AdminReport.css";

const STATUS_META = {
  new: { label: "ใหม่", badge: "status-new" },
  reading: { label: "กำลังตรวจสอบ", badge: "status-reading" },
  resolved: { label: "แก้ไขแล้ว", badge: "status-resolved" }
};

const CATEGORY_META = {
  technical: { label: "ปัญหาทางเทคนิค", icon: "⚡" },
  display: { label: "ปัญหาการแสดงผล", icon: "🖼️" },
  payment: { label: "ปัญหาการเงิน", icon: "💰" },
  upload: { label: "ปัญหาอัปโหลด", icon: "📁" },
  account: { label: "บัญชีผู้ใช้", icon: "👤" },
  suggestion: { label: "ข้อเสนอแนะ", icon: "💡" },
  other: { label: "อื่นๆ", icon: "📝" }
};

const statusFilters = [
  { id: "all", label: "กำลังดำเนินการ" },
  { id: "new", label: "ใหม่" },
  { id: "reading", label: "กำลังตรวจสอบ" },
  { id: "resolved", label: "แก้ไขแล้ว" }
];

export default function AdminReport() {
  const {
    loading,
    error,
    filter,
    setFilter,
    search,
    setSearch,
    activeReport,
    setActiveReport,
    updatingId,
    loadReports,
    handleStatusChange,
    formatDate,
    filteredReports,
    stats,
    viewDescription
  } = useAdminReport();

  const renderStatusPill = (status) => {
    const meta = STATUS_META[status] || { label: status, badge: "status-new" };
    return <span className={`status-pill ${meta.badge}`}>{meta.label}</span>;
  };

  return (
    <div className="admin-report-page">
      <header className="admin-report-header">
        <div className="hero-brand-group">
          <Link to="/home" className="back-nav-btn hero-back-btn" title="กลับหน้าหลัก">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="header-texts">
            <p className="eyebrow">ระบบรายงาน</p>
            <h1>ศูนย์ติดตามปัญหา</h1>
            <p className="subtitle">ข้อมูลเชื่อมต่อจากฝั่งผู้ใช้ทันที ปรับสถานะงานได้ตามจริง</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="primary-btn" onClick={loadReports}>รีเฟรชข้อมูล</button>
        </div>
      </header>

      <section className="summary-grid">
        <div className="summary-card">
          <span className="summary-label">รายงานทั้งหมด</span>
          <strong>{stats.total}</strong>
        </div>
        <div className="summary-card">
          <span className="summary-label">ใหม่</span>
          <strong>{stats.new || 0}</strong>
        </div>
        <div className="summary-card">
          <span className="summary-label">กำลังตรวจสอบ</span>
          <strong>{stats.reading || 0}</strong>
        </div>
        <div className="summary-card">
          <span className="summary-label">แก้ไขแล้ว</span>
          <strong>{stats.resolved || 0}</strong>
        </div>
      </section>

      <section className="report-controls">
        <div className="search-box">
          <span role="img" aria-label="search">🔍</span>
          <input
            type="text"
            placeholder="ค้นหาจากหมวดหมู่หรือคำอธิบาย"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-group">
          {statusFilters.map((item) => (
            <button
              key={item.id}
              className={`filter-chip ${filter === item.id ? "active" : ""}`}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <p className="view-hint">{viewDescription}</p>

      {error && <div className="error-banner-lite">{error}</div>}

      {loading ? (
        <div className="state-card">กำลังโหลดข้อมูล...</div>
      ) : filteredReports.length === 0 ? (
        <div className="state-card">
          {filter === "resolved" ? "ยังไม่มีงานที่ปิดแล้ว" : "ยังไม่มีรายงานในหมวดนี้"}
        </div>
      ) : (
        <div className="report-list">
          {filteredReports.map((report) => {
            const category = CATEGORY_META[report.category] || CATEGORY_META.other;
            return (
              <article key={report.id} className="report-card" onClick={() => setActiveReport(report)}>
                <div className="report-card-top">
                  <div className="category-chip">
                    <span>{category.icon}</span>
                    <span>{category.label}</span>
                  </div>
                  {renderStatusPill(report.status)}
                </div>
                <p className="report-detail">{report.detail}</p>
                <div className="report-meta">
                  <span>{formatDate(report.createdAt)}</span>
                  <button
                    className="link-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveReport(report);
                    }}
                  >
                    ดูรายละเอียด
                  </button>
                </div>
                <div className="report-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className={`action-btn ghost ${report.status === "new" ? "active" : ""}`}
                    onClick={() => handleStatusChange(report, "new")}
                    disabled={updatingId === report.id}
                  >
                    ใหม่
                  </button>
                  <button
                    className={`action-btn ghost ${report.status === "reading" ? "active" : ""}`}
                    onClick={() => handleStatusChange(report, "reading")}
                    disabled={updatingId === report.id}
                  >
                    ตรวจสอบอยู่
                  </button>
                  <button
                    className={`action-btn success ${report.status === "resolved" ? "active" : ""}`}
                    onClick={() => handleStatusChange(report, "resolved")}
                    disabled={updatingId === report.id}
                  >
                    ปิดงาน
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {activeReport && (
        <>
          <div className="report-drawer-overlay" onClick={() => setActiveReport(null)}></div>
          <div className="report-drawer" role="dialog">
            <div className="drawer-header">
              <div>
                <p>รายละเอียดรายงาน</p>
                <h3>{CATEGORY_META[activeReport.category]?.label || "ไม่ทราบ"}</h3>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setActiveReport(null)} aria-label="ปิดหน้าต่าง">✕</button>
            </div>
            <div className="drawer-body">
              <div className="drawer-section">
                <span className="section-label">สถานะปัจจุบัน</span>
                {renderStatusPill(activeReport.status)}
              </div>
              <div className="drawer-section">
                <span className="section-label">รายละเอียด</span>
                <p className="drawer-detail">{activeReport.detail}</p>
              </div>
              <div className="drawer-timeline">
                <div>
                  <span>สร้างเมื่อ</span>
                  <strong>{formatDate(activeReport.createdAt)}</strong>
                </div>
                {activeReport.updatedAt && (
                  <div>
                    <span>อัปเดตล่าสุด</span>
                    <strong>{formatDate(activeReport.updatedAt)}</strong>
                  </div>
                )}
              </div>
            </div>
            <div className="drawer-actions">
              <button
                className="ghost-btn"
                onClick={() => handleStatusChange(activeReport, "reading")}
                disabled={updatingId === activeReport.id}
              >
                ทำเครื่องหมายว่ากำลังตรวจสอบ
              </button>
              <button
                className="primary-btn"
                onClick={() => handleStatusChange(activeReport, "resolved")}
                disabled={updatingId === activeReport.id}
              >
                ปิดงานนี้
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
