import React from "react";
import { USER_API_URL } from "../../config/apiConfig";

export default function QueueHistoryModal({
  showHistory,
  setShowHistory,
  historyItems = [],
  giftSettings = [],
  getImageUrl,
  handleRestoreToQueue,
  renderSocialOnImage,
  formatDate,
}) {
  if (!showHistory) return null;

  return (
    <div className="history-modal-overlay" onClick={() => setShowHistory(false)}>
      <div className="history-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="history-modal-header">
          <div className="history-modal-title-group">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <div>
              <h2 className="history-modal-title">ประวัติคิว</h2>
              <p className="history-modal-subtitle">
                รายการทั้งหมด {historyItems.length} รายการ
              </p>
            </div>
          </div>
          <button
            className="history-modal-close-btn"
            onClick={() => setShowHistory(false)}
            aria-label="ปิดหน้าต่าง"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Body */}
        <div className="history-modal-body">
          {historyItems.length === 0 ? (
            <div className="history-modal-empty-state">
              <svg
                width="80"
                height="80"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                className="history-modal-empty-icon"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <h3 className="history-modal-empty-text">ยังไม่มีประวัติ</h3>
              <p className="history-modal-empty-subtext">เมื่อมีการอนุมัติหรือปฏิเสธรูปภาพจะแสดงที่นี่</p>
            </div>
          ) : (
            <div className="history-modal-grid">
              {historyItems.map((item) => {
                const isApproved = item.status === "approved" || item.status === "completed";
                const statusColorClass = isApproved ? "approved" : "rejected";
                const statusIcon = isApproved ? "✓" : "✗";
                const statusText = item.status === "completed" ? "เล่นจบ" : isApproved ? "อนุมัติ" : "ปฏิเสธ";

                // Resolve social fields from top-level (flattened by backend) or fallback to metadata
                const socialType = item.socialType || item.metadata?.social?.type || null;
                const socialName = item.socialName || item.metadata?.social?.name || null;
                const socialColor = item.socialColor || item.metadata?.socialColor || '#ffffff';
                const textColor = item.textColor || item.metadata?.theme || null;
                const textLayout = item.textLayout || item.metadata?.textLayout || 'right';

                return (
                  <div key={item._id || item.id} className="history-card">
                    {/* Status Badge */}
                    <div className={`history-card-status-badge ${statusColorClass}`}>
                      <span>{statusIcon}</span>
                      {statusText}
                    </div>

                    {/* Image/Media preview area */}
                    <div className="history-card-preview-area">
                      {item.type === "gift" ? (
                        (() => {
                          const firstGiftItem = item.metadata?.giftItems?.[0];
                          let giftImage = null;

                          if (firstGiftItem) {
                            giftImage = firstGiftItem.image;
                            if (!giftImage && giftSettings.length > 0) {
                              const setting = giftSettings.find((s) => s.id === firstGiftItem.id);
                              if (setting && setting.imageUrl) {
                                giftImage = setting.imageUrl;
                              }
                            }
                          }

                          return giftImage ? (
                            <img
                              src={getImageUrl(giftImage)}
                              alt="Gift preview"
                              className="history-card-preview-img"
                              onError={(e) => {
                                e.target.style.display = "none";
                                e.target.parentElement.innerHTML =
                                  '<div class="history-card-preview-fallback" style="color:#f59e0b"><div style="font-size:64px">🎁</div><span style="font-size:14px">ของขวัญ</span></div>';
                              }}
                            />
                          ) : (
                            <div className="history-card-preview-fallback" style={{ color: "#f59e0b" }}>
                              <div style={{ fontSize: "64px", marginBottom: "8px" }}>🎁</div>
                              <p style={{ fontSize: "14px", margin: 0 }}>ของขวัญ</p>
                            </div>
                          );
                        })()
                      ) : item.filePath || item.mediaUrl ? (
                        <img
                          src={getImageUrl(item.filePath || item.mediaUrl)}
                          alt="History preview"
                          className="history-card-preview-img"
                          onError={(e) => {
                            e.target.style.display = "none";
                            e.target.parentElement.innerHTML =
                              '<div class="history-card-preview-fallback" style="color:#94a3b8"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg><span style="font-size:13px">ไม่มีรูปภาพ</span></div>';
                          }}
                        />
                      ) : (
                        <div className="history-card-preview-fallback" style={{ color: "#94a3b8" }}>
                          <svg
                            width="48"
                            height="48"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1"
                            style={{ margin: "0 auto 8px" }}
                          >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                          <p style={{ fontSize: "13px", margin: 0 }}>ข้อความอย่างเดียว</p>
                        </div>
                      )}
                    </div>

                    {/* Card Info */}
                    <div className="history-card-info">
                      <div className="history-card-sender-group">
                        <div className="history-card-sender-wrap">
                          {/* Avatar */}
                          <div className="history-card-avatar">
                            {item.avatar ? (
                              <img
                                src={getImageUrl(item.avatar, USER_API_URL)}
                                alt={item.sender}
                                onError={(e) => {
                                  e.target.style.display = "none";
                                  const initial = document.createElement("span");
                                  initial.className = "history-card-avatar-text";
                                  initial.textContent = (item.sender || "U").charAt(0).toUpperCase();
                                  e.target.parentElement.appendChild(initial);
                                }}
                              />
                            ) : (
                              <span className="history-card-avatar-text">
                                {(item.sender || "U").charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="history-card-sender-details">
                            <div className="history-card-sender-name">
                              {item.sender}
                            </div>
                            <div className="history-card-timestamp">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                              </svg>
                              {formatDate(item.checkedAt || item.approvalDate)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Duration & Price */}
                      <div className="history-card-stats-grid">
                        <div className="history-card-stat-item">
                          <div className="history-card-stat-icon duration">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                          </div>
                          <div>
                            <div className="history-card-stat-label">เวลา</div>
                            <div className="history-card-stat-value">
                              {item.duration ?? item.metadata?.duration ?? "N/A"} วินาที
                            </div>
                          </div>
                        </div>

                        <div className="history-card-stat-item">
                          <div className="history-card-stat-icon price">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="12" y1="1" x2="12" y2="23" />
                              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                            </svg>
                          </div>
                          <div>
                            <div className="history-card-stat-label">ราคา</div>
                            <div className="history-card-stat-value">
                              {item.price === 0 ? "ฟรี" : `฿${item.price}`}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Message/Content Text with proper textColor */}
                      {item.content && (
                        <div className="history-card-text-content">
                          <div className="history-card-text-label">ข้อความ</div>
                          <div
                            className="history-card-text-val"
                            style={
                              textColor && textColor !== "white" && textColor !== "#ffffff"
                                ? { color: textColor }
                                : {}
                            }
                          >
                            {item.content}
                          </div>
                        </div>
                      )}

                      {/* Text Color indicator */}
                      {textColor && textColor !== "white" && textColor !== "#ffffff" && (
                        <div className="history-card-meta-badge">
                          <span className="history-card-meta-label">สีข้อความ:</span>
                          <span
                            className="history-card-color-dot"
                            style={{ background: textColor }}
                          ></span>
                          <span className="history-card-meta-value">{textColor}</span>
                        </div>
                      )}

                      {/* Layout indicator */}
                      {textLayout && textLayout !== "right" && (
                        <div className="history-card-meta-badge">
                          <span className="history-card-meta-label">📐 Layout:</span>
                          <span className="history-card-meta-value">
                            {textLayout === "left"
                              ? "ซ้าย"
                              : textLayout === "top"
                              ? "บน"
                              : textLayout === "bottom"
                              ? "ล่าง"
                              : textLayout === "center"
                              ? "กลาง"
                              : textLayout}
                          </span>
                        </div>
                      )}

                      {/* Social Badge info — now using top-level flattened fields */}
                      {socialType && socialName && (
                        <div className="history-card-social-badge">
                          <div className="history-card-social-label">Social:</div>
                          <div>
                            {renderSocialOnImage(socialType, socialName, socialColor)}
                          </div>
                        </div>
                      )}

                      {/* Social Color indicator */}
                      {socialColor &&
                        socialColor !== "#ffffff" &&
                        socialColor !== "white" && (
                          <div className="history-card-meta-badge">
                            <span className="history-card-meta-label">สี Social:</span>
                            <span
                              className="history-card-color-dot"
                              style={{ background: socialColor }}
                            ></span>
                            <span className="history-card-meta-value">{socialColor}</span>
                          </div>
                        )}

                      {/* Restore button */}
                      <button
                        onClick={() => handleRestoreToQueue(item.id || item._id)}
                        className="history-card-restore-btn"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="23 4 23 10 17 10" />
                          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                        </svg>
                        กลับเข้าคิว
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
