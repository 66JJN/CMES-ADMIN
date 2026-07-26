import React from "react";
import BackNavLink from "../ui/BackNavLink";
import "./TimeHistoryPanel.css";

/**
 * Presentational Component for displaying Time History list.
 * Pure UI relying on props for rendering categorized cards.
 */
export default function TimeHistoryPanel({
  textHistory = [],
  imageHistory = [],
  birthdayHistory = [],
  handleRemove,
}) {
  return (
    <div className="th-minimal-container">
      {/* Header พร้อมปุ่มย้อนกลับ */}
      <header className="th-minimal-header">
        <div className="th-header-left">
          <BackNavLink />
          <h1 className="th-minimal-title">ประวัติการตั้งเวลา</h1>
        </div>
      </header>

      {/* Main Content: แสดงประวัติแบ่งเป็น 3 หมวด */}
      <main className="th-minimal-main">
        {/* Card แสดงประวัติข้อความ */}
        <div className="th-minimal-card th-card-text">
          <h2 className="th-minimal-card-title th-text">📝 ข้อความ</h2>
          {textHistory.length === 0 ? (
            <p className="th-minimal-empty">ไม่มีประวัติการตั้งค่าข้อความ</p>
          ) : (
            textHistory.map((item) => (
              <div key={item.id} className="th-minimal-item th-item-text">
                <div>
                  <span className="th-minimal-label">🕒 วันที่:</span>
                  <span>{item.date}</span>
                </div>
                <div>
                  <span className="th-minimal-label">⏱ ระยะเวลา:</span>
                  <span>{item.duration}</span>
                </div>
                <div>
                  <span className="th-minimal-label">💵 ราคา:</span>
                  <span>{item.price === 0 ? 'ฟรี' : `${item.price} บาท`}</span>
                </div>
                <div className="th-minimal-item-actions">
                  <button
                    className="th-minimal-remove-btn"
                    onClick={() => handleRemove(item.id)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18"></path>
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    </svg>
                    ลบ
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Card แสดงประวัติรูปภาพ */}
        <div className="th-minimal-card th-card-image">
          <h2 className="th-minimal-card-title th-image">🖼️ รูปภาพ</h2>
          {imageHistory.length === 0 ? (
            <p className="th-minimal-empty">ไม่มีประวัติการตั้งค่ารูปภาพ</p>
          ) : (
            imageHistory.map((item) => (
              <div key={item.id} className="th-minimal-item th-item-image">
                <div>
                  <span className="th-minimal-label">🕒 วันที่:</span>
                  <span>{item.date}</span>
                </div>
                <div>
                  <span className="th-minimal-label">⏱ ระยะเวลา:</span>
                  <span>{item.duration}</span>
                </div>
                <div>
                  <span className="th-minimal-label">💵 ราคา:</span>
                  <span>{item.price === 0 ? 'ฟรี' : `${item.price} บาท`}</span>
                </div>
                <div className="th-minimal-item-actions">
                  <button
                    className="th-minimal-remove-btn"
                    onClick={() => handleRemove(item.id)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18"></path>
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    </svg>
                    ลบ
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Card แสดงประวัติวันเกิด */}
        <div className="th-minimal-card th-card-birthday">
          <h2 className="th-minimal-card-title th-birthday">🎂 วันเกิด</h2>
          {birthdayHistory.length === 0 ? (
            <p className="th-minimal-empty">ไม่มีประวัติการตั้งค่าวันเกิด</p>
          ) : (
            birthdayHistory.map((item) => (
              <div key={item.id} className="th-minimal-item th-item-birthday">
                <div>
                  <span className="th-minimal-label">🕒 วันที่:</span>
                  <span>{item.date}</span>
                </div>
                <div>
                  <span className="th-minimal-label">⏱ ระยะเวลา:</span>
                  <span>{item.duration}</span>
                </div>
                <div>
                  <span className="th-minimal-label">💵 ราคา:</span>
                  <span>{item.price === 0 ? 'ฟรี' : `${item.price} บาท`}</span>
                </div>
                <div className="th-minimal-item-actions">
                  <button
                    className="th-minimal-remove-btn"
                    onClick={() => handleRemove(item.id)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18"></path>
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    </svg>
                    ลบ
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
