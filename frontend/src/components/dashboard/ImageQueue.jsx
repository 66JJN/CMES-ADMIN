import React from "react";
import BackNavLink from "../ui/BackNavLink";
import useImageQueue from "../../hooks/useImageQueue";
import QueueHistoryModal from "./QueueHistoryModal";
import "./DashboardShared.css";
import "./ImageQueue.css";

// Import social logos
import igLogo from "../../data-icon/ig-logo.png";
import fbLogo from "../../data-icon/facebook-logo.png";
import lineLogo from "../../data-icon/line-logo.png";
import tiktokLogo from "../../data-icon/tiktok-logo.png";

import { API_BASE_URL, USER_API_URL } from "../../config/apiConfig";
import adminFetch from "../../config/authFetch";

// Helper for formatting date
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Helper for formatting time (MM:SS)
const formatTime = (seconds) => {
  const s = Math.floor(seconds);
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

export default function ImageQueue() {
  const {
    images,
    loading,
    selectedImage,
    setSelectedImage,
    showModal,
    setShowModal,
    showHistory,
    setShowHistory,
    historyItems,
    categoryFilter,
    setCategoryFilter,
    giftSettings,
    editWidth,
    setEditWidth,
    editHeight,
    setEditHeight,
    editGiftItems,
    setEditGiftItems,
    isEditingGift,
    setIsEditingGift,
    showAddGiftItem,
    setShowAddGiftItem,
    savingGiftItems,
    setSavingGiftItems,
    currentPreview,
    previewQueue,
    timeLeft,
    isPaused,
    pauseTimeLeft,
    queueControl,
    progressRatio,
    getImageUrl,
    fetchImages,
    fetchHistory,
    handleSkipCurrent,
    setPlaybackPaused,
    retryQueue,
    handleRestoreToQueue,
    handleImageClick,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    handleApprove,
    handleReject,
    draggedIndex,
  } = useImageQueue();

  // Render social logo overlay helper
  function renderSocialOnImage(socialType, socialName, socialColor) {
    const logoMap = {
      ig: igLogo,
      fb: fbLogo,
      line: lineLogo,
      tiktok: tiktokLogo,
    };

    const logoSrc = logoMap[socialType];
    if (!logoSrc) return null;

    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <img
          src={logoSrc}
          alt={socialType.toUpperCase()}
          style={{ width: "22px", height: "22px", objectFit: "contain" }}
        />
        <span
          style={{
            fontWeight: "700",
            fontSize: "20px",
            color: socialColor || "#fff",
            textShadow: "0 2px 6px rgba(0,0,0,0.8)",
          }}
        >
          {socialName}
        </span>
      </span>
    );
  }

  // Render simplified gift order for queue cards
  function renderGiftOrder(item) {
    const gift = item.giftOrder || {};
    const senderInfo = item.sender || "ผู้ส่ง";
    const targetTable = gift.tableNumber || "-";

    return (
      <div className="gift-order-card-simple">
        <div className="gift-simple-header">
          <span className="gift-icon">🎁</span>
          <h3>คำสั่งของขวัญ</h3>
        </div>

        <div className="gift-simple-info">
          <div className="gift-info-row">
            <span className="label">👤 ผู้ส่ง:</span>
            <span className="value">{senderInfo}</span>
          </div>
          <div className="gift-info-row">
            <span className="label">📍 โต๊ะ:</span>
            <span className="value highlight">{targetTable}</span>
          </div>
          {gift.note && (
            <div className="gift-info-row message">
              <span className="label">💬 ข้อความ:</span>
              <span className="value message-text">"{gift.note}"</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render full details gift card (for Modal & Preview)
  function renderGiftOrderFull(item, isCompact = false) {
    const gift = item.giftOrder || {};
    const senderInfo = item.sender || "ผู้ส่ง";
    const targetTable = gift.tableNumber || "-";
    const avatarUrl = item.avatar || null;

    return (
      <div className={`gift-order-card-new ${isCompact ? "compact" : ""}`}>
        {/* Header with animation */}
        <div className="gift-header-sparkle">
          <span className="sparkle">✨</span>
          <span className="sparkle">🍻</span>
          <h2 className="gift-title">NEW GIFT INCOMING!</h2>
          <span className="sparkle">🍻</span>
          <span className="sparkle">✨</span>
        </div>

        {/* Sender Info with Avatar */}
        <div className="gift-sender-section">
          <div className="avatar-ring">
            <div className="avatar-circle">
              {avatarUrl ? (
                <img
                  src={getImageUrl(avatarUrl, USER_API_URL)}
                  alt={senderInfo}
                  className="avatar-user-image"
                  onError={(e) => {
                    e.target.style.display = "none";
                    e.target.nextSibling.style.display = "flex";
                  }}
                />
              ) : null}
              <span
                className="avatar-text"
                style={{ display: avatarUrl ? "none" : "flex" }}
              >
                {senderInfo.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
          <h3 className="sender-name">⭐ คุณ {senderInfo} ⭐</h3>
        </div>

        {/* Arrow Down */}
        <div className="gift-arrow">
          <span>⬇️ จัดส่งให้ ⬇️</span>
        </div>

        {/* Target Table */}
        <div className="gift-target-table">
          <div className="table-badge">โต๊ะ {targetTable}</div>
        </div>

        {/* Divider */}
        <div className="gift-divider"></div>

        {/* Gift Items with Images */}
        <div className="gift-items-gallery">
          {(gift.items || []).map((giftItem, idx) => {
            let itemImage = giftItem.image || giftItem.imageUrl;
            if (!itemImage && giftSettings.length > 0) {
              let setting = giftSettings.find((s) => s.id === giftItem.id);
              if (!setting) {
                setting = giftSettings.find((s) => s.name === giftItem.name);
              }
              if (setting && setting.imageUrl) {
                itemImage = setting.imageUrl;
              }
            }

            return (
              <div key={`${item._id || item.id}-${giftItem.id || idx}`} className="gift-item-card">
                {itemImage ? (
                  <img
                    src={getImageUrl(itemImage)}
                    alt={giftItem.name}
                    className="gift-item-image"
                    onError={(e) => {
                      e.target.style.display = "none";
                      e.target.nextSibling.style.display = "flex";
                    }}
                  />
                ) : null}
                <div className="gift-item-placeholder" style={{ display: itemImage ? "none" : "flex" }}>
                  {giftItem.name ? giftItem.name.charAt(0) : "?"}
                </div>
                <span className="gift-item-quantity">x{giftItem.quantity}</span>
                <p className="gift-item-name">{giftItem.name}</p>
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div className="gift-divider"></div>

        {/* Note Message */}
        {gift.note && (
          <div className="gift-note-section">
            <span className="quote-icon">💬</span>
            <p className="gift-note-text">"{gift.note}"</p>
            <span className="quote-icon">💬</span>
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="queue-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="queue-container">
      <header className="dashboard-header">
        <div className="header-title-group">
          <BackNavLink />
          <h1 className="header-title">ตรวจสอบเนื้อหา</h1>
        </div>

        <div className="header-controls">
          <div className="stat-capsule">
            <span className="stat-label">คิวรอตรวจสอบ</span>
            <span className="stat-value">{images.length}</span>
          </div>
          <button
            onClick={() => {
              fetchHistory();
              setShowHistory(true);
            }}
            className="action-btn"
            title="ประวัติการอนุมัติ"
          >
            <span style={{ fontSize: "16px" }}>📜</span>
            <span>ประวัติ</span>
          </button>
          <button onClick={fetchImages} className="action-btn" title="โหลดข้อมูลใหม่">
            <span style={{ fontSize: "16px" }}>🔄</span>
            <span>รีเฟรช</span>
          </button>
        </div>
      </header>

      <div className="filter-bar">
        {["all", "image", "text", "birthday", "gift"].map((type) => (
          <button
            key={type}
            onClick={() => setCategoryFilter(type)}
            className={`filter-pill ${categoryFilter === type ? "active" : ""}`}
            data-type={type}
          >
            {type === "all" && "📑 ทั้งหมด"}
            {type === "image" && "🖼️ รูปภาพ"}
            {type === "text" && "💬 ข้อความ"}
            {type === "birthday" && "🎂 วันเกิด"}
            {type === "gift" && "🎁 ของขวัญ"}
            <span className="filter-count">
              {type === "all"
                ? images.length
                : images.filter((img) => (type === "image" ? img.type === "image" || !img.type : img.type === type))
                    .length}
            </span>
          </button>
        ))}
      </div>

      <main className="main-layout">
        {/* Left Section - Queue (70%) */}
        <div className="queue-section">
          <div className="queue-content">
            {images.length === 0 ? (
              <div className="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
                <p>ไม่มีรูปภาพส่งมา</p>
              </div>
            ) : (
              <div className="images-grid">
                {images
                  .filter((image) => image.status === "pending")
                  .filter(
                    (image) =>
                      categoryFilter === "all" ||
                      image.type === categoryFilter ||
                      (categoryFilter === "image" && !image.type)
                  )
                  .map((image, index) => {
                    const categoryColor =
                      image.type === "gift"
                        ? "#f59e0b"
                        : image.type === "birthday"
                        ? "#ec4899"
                        : image.type === "text"
                        ? "#22c55e"
                        : "#6366f1";

                    const isImageOnly = image.type === "image" || image.type === "birthday" || !image.type;

                    return (
                      <div
                        key={image._id || image.id}
                        className="image-card"
                        onClick={() => handleImageClick(image)}
                        style={{ borderTop: `4px solid ${categoryColor}` }}
                      >
                        <div
                          className="card-header"
                          style={{
                            padding: "12px 16px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            borderBottom: "1px solid #f1f5f9",
                            gap: "12px",
                          }}
                        >
                          <span
                            className="queue-number"
                            style={{
                              background: categoryColor,
                              color: "white",
                              padding: "2px 8px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: "700",
                              flexShrink: 0,
                            }}
                          >
                            #{index + 1}
                          </span>

                          {/* Avatar + Sender */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              flex: 1,
                              minWidth: 0,
                            }}
                          >
                            {/* Avatar */}
                            <div
                              style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "50%",
                                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                overflow: "hidden",
                              }}
                            >
                              {image.avatar ? (
                                <img
                                  src={getImageUrl(image.avatar, USER_API_URL)}
                                  alt={image.sender}
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                  }}
                                  onError={(e) => {
                                    e.target.style.display = "none";
                                    const initial = document.createElement("span");
                                    initial.textContent = (image.sender || "U").charAt(0).toUpperCase();
                                    initial.style.fontSize = "14px";
                                    initial.style.fontWeight = "700";
                                    initial.style.color = "#fff";
                                    e.target.parentElement.appendChild(initial);
                                  }}
                                />
                              ) : (
                                <span
                                  style={{
                                    fontSize: "14px",
                                    fontWeight: "700",
                                    color: "#fff",
                                  }}
                                >
                                  {(image.sender || "U").charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>

                            {/* Sender Name */}
                            <span
                              className="sender"
                              style={{
                                fontSize: "14px",
                                fontWeight: "600",
                                color: "#334155",
                                overflow: "hidden",
                                textShadow: "none",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {image.sender}
                            </span>
                          </div>
                        </div>

                        {/* Main Content */}
                        <div
                          className="image-preview-container"
                          style={{
                            position: "relative",
                            background: isImageOnly ? "#e2e8f0" : undefined,
                          }}
                        >
                          {image.type === "gift" ? (
                            renderGiftOrder(image)
                          ) : image.filePath ? (
                            <>
                              <img
                                src={getImageUrl(image.filePath)}
                                alt="Preview"
                                className="preview-image"
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "contain",
                                  display: "block",
                                }}
                              />

                              {/* Overlay for specific layouts */}
                              {!isImageOnly &&
                                !image.composed &&
                                image.composed !== "1" &&
                                ((image.socialType && image.socialName) || image.text) && (
                                  <div
                                    className="preview-overlay-center"
                                    style={{
                                      position: "absolute",
                                      bottom: "10px",
                                      left: "0",
                                      right: "0",
                                      display: "flex",
                                      flexDirection: "column",
                                      alignItems: "center",
                                      zIndex: 2,
                                    }}
                                  >
                                    {image.socialType && image.socialName && (
                                      <div
                                        className="preview-social-overlay"
                                        style={{
                                          marginBottom: "4px",
                                          color: "#fff",
                                          padding: "4px 12px",
                                          background: "rgba(0,0,0,0.4)",
                                          borderRadius: "20px",
                                          fontWeight: "600",
                                          fontSize: "14px",
                                          backdropFilter: "blur(4px)",
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "6px",
                                        }}
                                      >
                                        {renderSocialOnImage(
                                          image.socialType,
                                          image.socialName,
                                          image.socialColor
                                        )}
                                      </div>
                                    )}
                                    {image.text && (
                                      <div
                                        className="preview-text-overlay"
                                        style={{
                                          color: image.textColor,
                                          background: "rgba(0,0,0,0.6)",
                                          borderRadius: "8px",
                                          padding: "8px 16px",
                                          fontWeight: "500",
                                          fontSize: "16px",
                                          marginTop: "4px",
                                          maxWidth: "90%",
                                          textAlign: "center",
                                          backdropFilter: "blur(2px)",
                                        }}
                                      >
                                        {image.text}
                                      </div>
                                    )}
                                  </div>
                                )}
                            </>
                          ) : (
                            // Text only card
                            <div
                              className="text-only-card"
                              style={{
                                background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
                                width: "100%",
                                height: "100%",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "20px",
                              }}
                            >
                              {image.socialType && image.socialName && (
                                <div
                                  style={{
                                    marginBottom: "12px",
                                    color: "#fff",
                                    padding: "6px 16px",
                                    background: "rgba(255,255,255,0.2)",
                                    borderRadius: "20px",
                                    fontWeight: "700",
                                    fontSize: "16px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                  }}
                                >
                                  {renderSocialOnImage(image.socialType, image.socialName, image.socialColor)}
                                </div>
                              )}
                              <div
                                style={{
                                  color: image.textColor || "#fff",
                                  fontWeight: "600",
                                  fontSize: "20px",
                                  textAlign: "center",
                                  wordBreak: "break-word",
                                  textShadow: "0 2px 4px rgba(0,0,0,0.2)",
                                }}
                              >
                                {image.text}
                              </div>
                            </div>
                          )}
                        </div>

                        <div
                          className="card-footer"
                          style={{
                            padding: "12px 16px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            background: "#f8fafc",
                            borderTop: "1px solid #f1f5f9",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                              alignItems: "center",
                              flexWrap: "wrap",
                            }}
                          >
                            <span
                              className="time"
                              style={{
                                fontSize: "12px",
                                color: "#64748b",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              ⏱️ {image.time}s
                            </span>
                            {image.textLayout && image.textLayout !== "right" && (
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: "#6366f1",
                                  background: "#eef2ff",
                                  padding: "2px 8px",
                                  borderRadius: "6px",
                                  fontWeight: "600",
                                }}
                              >
                                📐{" "}
                                {image.textLayout === "left"
                                  ? "ซ้าย"
                                  : image.textLayout === "top"
                                  ? "บน"
                                  : image.textLayout === "bottom"
                                  ? "ล่าง"
                                  : image.textLayout === "center"
                                  ? "กลาง"
                                  : image.textLayout}
                              </span>
                            )}
                            {image.socialColor &&
                              image.socialColor !== "#ffffff" &&
                              image.socialColor !== "white" && (
                                <span
                                  style={{
                                    display: "inline-block",
                                    width: "14px",
                                    height: "14px",
                                    background: image.socialColor,
                                    borderRadius: "50%",
                                    border: "2px solid #e2e8f0",
                                    verticalAlign: "middle",
                                  }}
                                  title={`สี Social: ${image.socialColor}`}
                                ></span>
                              )}
                          </div>

                          {/* AI Moderation Badge */}
                          {image.aiModeration && image.aiModeration.checked && (
                            <span
                              style={{
                                fontSize: "11px",
                                padding: "3px 10px",
                                borderRadius: "6px",
                                fontWeight: "700",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                ...(image.aiModeration.safe
                                  ? { background: "#d1fae5", color: "#065f46" }
                                  : { background: "#fee2e2", color: "#991b1b" }),
                              }}
                              title={image.aiModeration.reasons?.join(", ") || "AI ตรวจสอบแล้ว"}
                            >
                              {image.aiModeration.safe ? "🤖 AI ✓" : "⚠️ AI พบปัญหา"}
                            </span>
                          )}

                          <div className="price" style={{ fontWeight: "700", color: "#10b981", fontSize: "14px" }}>
                            {image.price === 0 ? "ฟรี" : `฿${image.price}`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Right Section - OBS Live Preview (30%) */}
        <div className="preview-section">
          <div className="preview-panel">
            <h2>รูปภาพที่กำลังแสดง</h2>

            {currentPreview ? (
              <>
                <div
                  className="preview-image-container"
                  style={{ position: "relative", minHeight: "400px", maxHeight: "400px" }}
                >
                  {/* Countdown Overlay for Next Queue */}
                  {isPaused && pauseTimeLeft > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "rgba(0, 0, 0, 0.85)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 20,
                        borderRadius: "12px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "18px",
                          color: "#a78bfa",
                          fontWeight: "600",
                          marginBottom: "20px",
                          textTransform: "uppercase",
                          letterSpacing: "2px",
                        }}
                      >
                        คิวถัดไป
                      </div>
                      <div
                        style={{
                          fontSize: "120px",
                          fontWeight: "700",
                          color: "white",
                          lineHeight: 1,
                          marginBottom: "16px",
                          textShadow: "0 0 40px rgba(139, 92, 246, 0.6)",
                        }}
                      >
                        {pauseTimeLeft}
                      </div>
                      <div style={{ fontSize: "16px", color: "#d1d5db", fontWeight: "500" }}>
                        เริ่มแสดงในอีก {pauseTimeLeft} วินาที
                      </div>
                      {/* Progress bar line */}
                      <div
                        style={{
                          marginTop: "30px",
                          width: "120px",
                          height: "8px",
                          background: "rgba(255, 255, 255, 0.1)",
                          borderRadius: "4px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${((15 - pauseTimeLeft) / 15) * 100}%`,
                            height: "100%",
                            background: "linear-gradient(90deg, #8b5cf6 0%, #6366f1 100%)",
                            transition: "width 1s linear",
                            borderRadius: "4px",
                          }}
                        ></div>
                      </div>
                      {/* Next queue avatar and name preview */}
                      {previewQueue[0] && previewQueue[0].filePath && (
                        <div
                          style={{
                            marginTop: "30px",
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            padding: "12px 20px",
                            background: "rgba(255, 255, 255, 0.05)",
                            borderRadius: "12px",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                          }}
                        >
                          <img
                            src={getImageUrl(previewQueue[0]?.filePath)}
                            alt="Next preview"
                            style={{
                              width: "60px",
                              height: "60px",
                              objectFit: "cover",
                              borderRadius: "8px",
                            }}
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                          <div style={{ textAlign: "left" }}>
                            <div style={{ color: "white", fontWeight: "600", fontSize: "14px" }}>
                              {previewQueue[0].sender}
                            </div>
                            <div style={{ color: "#9ca3af", fontSize: "12px", marginTop: "2px" }}>
                              {previewQueue[0].time} วินาที ·{" "}
                              {previewQueue[0].price === 0 ? "ฟรี" : `฿${previewQueue[0].price}`}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {currentPreview.type === "gift" ? (
                    renderGiftOrderFull(currentPreview, true)
                  ) : currentPreview.filePath ? (
                    <img
                      src={getImageUrl(currentPreview.filePath)}
                      alt="Preview"
                      className="preview-image"
                      style={{ width: "100%", height: "400px", objectFit: "contain" }}
                      onError={(e) => {
                        e.target.src =
                          "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1zbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y5ZmFmYiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9Iji1cHgiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5No Image</text></svg>";
                      }}
                    />
                  ) : (
                    // Text preview card
                    <div
                      style={{
                        background: "linear-gradient(135deg,#233046 60%,#1e293b 100%)",
                        borderRadius: "18px",
                        minHeight: "120px",
                        minWidth: "100%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                        padding: "24px 0",
                      }}
                    >
                      {currentPreview.socialType && currentPreview.socialName && (
                        <div
                          style={{
                            marginBottom: "16px",
                            marginTop: "8px",
                            color: "#fff",
                            padding: "6px 18px",
                            borderRadius: "8px",
                            fontWeight: "700",
                            fontSize: "20px",
                            textShadow: "0 2px 8px rgba(0,0,0,0.8)",
                            maxWidth: "100%",
                            wordBreak: "break-all",
                            display: "inline-flex",
                            alignItems: "center",
                          }}
                        >
                          {renderSocialOnImage(
                            currentPreview.socialType,
                            currentPreview.socialName,
                            currentPreview.socialColor
                          )}
                        </div>
                      )}
                      <div
                        style={{
                          color: currentPreview.textColor || "#fff",
                          borderRadius: "8px",
                          padding: "6px 16px",
                          fontWeight: "400",
                          fontSize: "18px",
                          textShadow:
                            currentPreview.textColor === "white"
                              ? "0 2px 8px rgba(0,0,0,0.8)"
                              : "0 2px 8px rgba(255,255,255,0.8)",
                          textAlign: "center",
                          wordBreak: "break-all",
                        }}
                      >
                        {currentPreview.text}
                      </div>
                    </div>
                  )}
                </div>

                <div className="countdown-section">
                  <div className="countdown-label">{queueControl.queuePaused ? "หยุดคิวชั่วคราว:" : isPaused ? "หน่วงเวลาระหว่างรูป:" : "เวลาที่เหลือ:"}</div>
                  <div
                    className={`countdown-timer ${
                      (timeLeft <= 10 && !isPaused) || (pauseTimeLeft <= 5 && isPaused) ? "warning" : ""
                    }`}
                  >
                    {queueControl.queuePaused ? formatTime(timeLeft) : isPaused ? formatTime(pauseTimeLeft) : formatTime(timeLeft)}
                  </div>
                  {timeLeft === 0 && !isPaused && <div className="time-up-message">หมดเวลาแล้ว!</div>}
                  {queueControl.queuePaused ? <div className="pause-message">เวลาถูกหยุดไว้จนกด Resume</div> : isPaused && pauseTimeLeft > 0 && <div className="pause-message">กำลังเปลี่ยนรูป...</div>}
                  <button
                    onClick={() => setPlaybackPaused(!queueControl.queuePaused).catch((error) => alert(error.message))}
                    className="refresh-button"
                    style={{ marginTop: "8px", width: "100%", padding: "10px", background: queueControl.queuePaused ? "#16a34a" : "#f59e0b", color: "white" }}
                  >
                    {queueControl.queuePaused ? "▶ Resume queue" : "⏸ Pause queue"}
                  </button>
                  <button
                    onClick={handleSkipCurrent}
                    className="refresh-button"
                    style={{ marginTop: "8px", width: "100%", padding: "10px", background: "#ef4444", color: "white" }}
                    disabled={!currentPreview}
                  >
                    ยกเลิกการแสดง / ข้ามคิวนี้
                  </button>
                </div>

                <div className="info-section">
                  <div className="info-row">
                    <span className="info-label">คิว:</span>
                    <span className="info-value">กำลังแสดง</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">เวลาการแสดง:</span>
                    <span className="info-value">{currentPreview.time} วินาที</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">แอปโมชั่น:</span>
                    <span className="info-value">ไม่มี</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">ข้อความ:</span>
                    <span className="info-value">{currentPreview.text || "ไม่มี"}</span>
                  </div>
                </div>

                {!isPaused && (
                  <div className="progress-section">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${progressRatio * 100}%`,
                        }}
                      ></div>
                    </div>
                    <div className="progress-text">{Math.round(progressRatio * 100)}% เสร็จสิ้น</div>
                  </div>
                )}
              </>
            ) : (
              <div
                className="no-preview"
                style={
                  isPaused && pauseTimeLeft > 0
                    ? {
                        minHeight: "450px",
                        background: "#fff",
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 10px 30px -10px rgba(0,0,0,0.05)",
                      }
                    : {}
                }
              >
                {isPaused && pauseTimeLeft > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "40px 0",
                      width: "100%",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "20px",
                        color: "#6366f1",
                        fontWeight: "700",
                        marginBottom: "20px",
                        textTransform: "uppercase",
                        letterSpacing: "1px",
                      }}
                    >
                      รอคิวถัดไป
                    </div>
                    <div
                      style={{
                        fontSize: "100px",
                        fontWeight: "800",
                        color: "#6366f1",
                        lineHeight: 1,
                        marginBottom: "10px",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {pauseTimeLeft}
                    </div>
                    <div
                      style={{
                        fontSize: "16px",
                        color: "#64748b",
                        fontWeight: "500",
                        marginBottom: "30px",
                      }}
                    >
                      วินาที
                    </div>
                    {previewQueue[0] && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "15px",
                          padding: "15px 25px",
                          background: "white",
                          borderRadius: "16px",
                          boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
                          border: "1px solid #f1f5f9",
                        }}
                      >
                        <img
                          src={getImageUrl(previewQueue[0].filePath)}
                          alt="Next"
                          style={{
                            width: "60px",
                            height: "60px",
                            borderRadius: "10px",
                            objectFit: "cover",
                          }}
                        />
                        <div style={{ textAlign: "left" }}>
                          <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>กำลังจะแสดง:</div>
                          <div style={{ fontSize: "15px", fontWeight: "600", color: "#1e293b" }}>
                            {previewQueue[0].sender || "ไม่ระบุชื่อ"}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                    <p>ยังไม่มีรูปภาพที่อนุมัติ</p>
                    <span>กดอนุมัติรูปภาพเพื่อแสดง Preview</span>
                  </>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", width: "100%", maxWidth: "320px", marginTop: "24px" }}>
                  <button
                    onClick={() => setPlaybackPaused(!queueControl.queuePaused).catch((error) => alert(error.message))}
                    className="refresh-button"
                    style={{ padding: "10px", background: queueControl.queuePaused ? "#16a34a" : "#f59e0b", color: "white" }}
                  >
                    {queueControl.queuePaused ? "▶ เล่นต่อ" : "⏸ หยุดคิว"}
                  </button>
                  <button
                    onClick={() => retryQueue().catch((error) => alert(error.message))}
                    className="refresh-button"
                    style={{ padding: "10px", background: "#6366f1", color: "white" }}
                  >
                    ↻ กู้คิว
                  </button>
                </div>
              </div>
            )}

            {/* Waiting Queue List with drag/drop re-ordering */}
            {previewQueue.length > 0 && (
              <div className="waiting-queue">
                <h3>คิวที่รออยู่ ({previewQueue.length})</h3>
                <p style={{ fontSize: "12px", color: "#64748b", marginTop: "4px", marginBottom: "12px" }}>
                  💡 ลากเพื่อจัดเรียงลำดับคิว
                </p>
                <div className="queue-list">
                  {previewQueue.map((queueImage, index) => (
                    <div
                      key={queueImage._id || queueImage.id}
                      className="queue-item"
                      draggable="true"
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={handleDrop}
                      style={{
                        cursor: "grab",
                        transition: "all 0.2s ease",
                        opacity: draggedIndex === index ? 0.5 : 1,
                      }}
                    >
                      <div className="queue-item-number">#{index + 1}</div>
                      <div className="queue-item-image">
                        <img
                          src={getImageUrl(queueImage.filePath)}
                          alt="Queue preview"
                          onError={(e) => {
                            e.target.src =
                              "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjZjlmYWZiIi8+PC9zdmc+";
                          }}
                        />
                      </div>
                      <div className="queue-item-info">
                        <div className="queue-item-time">{queueImage.time}วินาที</div>
                        <div className="queue-item-text">
                          {queueImage.text ? queueImage.text.slice(0, 15) + "..." : "ไม่มีข้อความ"}
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: "18px",
                          color: "#94a3b8",
                          marginLeft: "auto",
                          cursor: "grab",
                        }}
                      >
                        ⋮⋮
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modal image detail viewer */}
      {showModal && selectedImage && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>รายละเอียด{selectedImage.filePath ? "รูปภาพ" : "ข้อความ"}</h2>
              <button type="button" className="modal-close-btn" onClick={() => setShowModal(false)} aria-label="ปิดหน้าต่าง">
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-image-container">
                {selectedImage.type === "gift" ? (
                  renderGiftOrderFull(selectedImage, false)
                ) : selectedImage.filePath ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection:
                        selectedImage.textLayout === "left"
                          ? "row-reverse"
                          : selectedImage.textLayout === "top"
                          ? "column-reverse"
                          : selectedImage.textLayout === "bottom"
                          ? "column"
                          : "row",
                      gap: "20px",
                      alignItems:
                        selectedImage.textLayout === "top" || selectedImage.textLayout === "bottom"
                          ? "center"
                          : "stretch",
                      background: "#929292",
                      padding: "20px",
                      borderRadius: "12px",
                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                      maxWidth: "100%",
                      overflow: "hidden",
                    }}
                  >
                    {/* Left - Image */}
                    <div
                      style={{
                        width: "300px",
                        height: "375px",
                        flexShrink: 0,
                        background: "#929292",
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      <img
                        src={getImageUrl(selectedImage.filePath)}
                        alt="Full preview"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          display: "block",
                        }}
                      />
                    </div>

                    {/* Right - Text and QR code */}
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: "center",
                        minWidth: "200px",
                        maxWidth: "250px",
                        padding: "15px 10px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "16px",
                          width: "100%",
                        }}
                      >
                        {/* Social */}
                        {selectedImage.socialType && selectedImage.socialName && (
                          <div
                            style={{
                              color: "#fff",
                              fontWeight: "700",
                              fontSize: "18px",
                              textShadow: "0 2px 8px rgba(0,0,0,0.8)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "8px",
                              textAlign: "center",
                              wordBreak: "break-word",
                            }}
                          >
                            {renderSocialOnImage(
                              selectedImage.socialType,
                              selectedImage.socialName,
                              selectedImage.socialColor
                            )}
                          </div>
                        )}

                        {/* Text content */}
                        {selectedImage.text && (
                          <div
                            style={{
                              color: selectedImage.textColor || "#fff",
                              fontWeight: "400",
                              fontSize: "16px",
                              textShadow:
                                selectedImage.textColor === "white"
                                  ? "0 2px 8px rgba(0,0,0,0.8)"
                                  : "0 2px 8px rgba(255,255,255,0.8)",
                              textAlign: "center",
                              wordBreak: "break-word",
                              whiteSpace: "pre-wrap",
                              width: "100%",
                            }}
                          >
                            {selectedImage.text}
                          </div>
                        )}

                        {/* QR Code */}
                        {selectedImage.qrCodePath && (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <span
                              style={{
                                color: "#fff",
                                fontSize: "14px",
                                fontWeight: "600",
                                textShadow: "0 2px 4px rgba(0,0,0,0.6)",
                              }}
                            >
                              สแกนเลย!
                            </span>
                            <img
                              src={getImageUrl(selectedImage.qrCodePath)}
                              alt="QR Code"
                              style={{
                                width: "120px",
                                height: "120px",
                                objectFit: "contain",
                                background: "white",
                                padding: "8px",
                                borderRadius: "8px",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  // Text only detail
                  <div
                    style={{
                      background: "linear-gradient(135deg,#233046 60%,#1e293b 100%)",
                      borderRadius: "18px",
                      minHeight: "80px",
                      minWidth: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                      padding: "24px 0",
                    }}
                  >
                    {selectedImage.socialType && selectedImage.socialName && (
                      <div
                        style={{
                          marginBottom: "16px",
                          marginTop: "8px",
                          color: "#fff",
                          padding: "6px 18px",
                          borderRadius: "8px",
                          fontWeight: "700",
                          fontSize: "20px",
                          textShadow: "0 2px 8px rgba(0,0,0,0.8)",
                          maxWidth: "100%",
                          wordBreak: "break-all",
                          display: "inline-flex",
                          alignItems: "center",
                        }}
                      >
                        {renderSocialOnImage(
                          selectedImage.socialType,
                          selectedImage.socialName,
                          selectedImage.socialColor
                        )}
                      </div>
                    )}
                    <div
                      style={{
                        color: selectedImage.textColor || "#fff",
                        borderRadius: "8px",
                        padding: "6px 16px",
                        fontWeight: "400",
                        fontSize: "18px",
                        textShadow:
                          selectedImage.textColor === "white"
                            ? "0 2px 8px rgba(0,0,0,0.8)"
                            : "0 2px 8px rgba(255,255,255,0.8)",
                        textAlign: "center",
                        wordBreak: "break-all",
                      }}
                    >
                      {selectedImage.text}
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-details">
                {selectedImage.type !== "gift" && (
                  <>
                    <div className="detail-row">
                      <span className="label">ผู้ส่ง:</span>
                      <span className="value">{selectedImage.sender}</span>
                    </div>

                    <div className="detail-row">
                      <span className="label">ประเภท:</span>
                      <span
                        className="value"
                        style={{
                          background:
                            selectedImage.type === "birthday"
                              ? "#ec4899"
                              : selectedImage.type === "gift"
                              ? "#f59e0b"
                              : selectedImage.type === "text"
                              ? "#22c55e"
                              : "#6366f1",
                          color: "white",
                          padding: "4px 12px",
                          borderRadius: "12px",
                          fontSize: "13px",
                          fontWeight: "600",
                        }}
                      >
                        {selectedImage.type === "birthday"
                          ? "🎂 วันเกิด"
                          : selectedImage.type === "gift"
                          ? "🎁 ของขวัญ"
                          : selectedImage.type === "text"
                          ? "💬 ข้อความ"
                          : "🖼️ รูปภาพ"}
                      </span>
                    </div>

                    {selectedImage.socialType && selectedImage.socialName && (
                      <div className="detail-row">
                        <span className="label">Social Media:</span>
                        <span className="value">
                          {selectedImage.socialType.toUpperCase()} - {selectedImage.socialName}
                        </span>
                      </div>
                    )}

                    {selectedImage.text && (
                      <div className="detail-row" style={{ flexDirection: "column", alignItems: "flex-start" }}>
                        <span className="label">ข้อความ:</span>
                        <span
                          className="value"
                          style={{
                            marginTop: "6px",
                            padding: "8px 12px",
                            background: "#f8fafc",
                            borderRadius: "8px",
                            width: "100%",
                            wordBreak: "break-word",
                            fontSize: "14px",
                          }}
                        >
                          {selectedImage.text}
                        </span>
                      </div>
                    )}

                    {selectedImage.textColor && (
                      <div className="detail-row">
                        <span className="label">สีข้อความ:</span>
                        <span className="value" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span
                            style={{
                              display: "inline-block",
                              width: "24px",
                              height: "24px",
                              background: selectedImage.textColor,
                              border: "2px solid #e2e8f0",
                              borderRadius: "6px",
                            }}
                          ></span>
                          {selectedImage.textColor}
                        </span>
                      </div>
                    )}

                    {selectedImage.socialColor &&
                      selectedImage.socialColor !== "#ffffff" &&
                      selectedImage.socialColor !== "white" && (
                        <div className="detail-row">
                          <span className="label">สี Social:</span>
                          <span className="value" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span
                              style={{
                                display: "inline-block",
                                width: "24px",
                                height: "24px",
                                background: selectedImage.socialColor,
                                border: "2px solid #e2e8f0",
                                borderRadius: "6px",
                              }}
                            ></span>
                            {selectedImage.socialColor}
                          </span>
                        </div>
                      )}

                    {selectedImage.textLayout && (
                      <div className="detail-row">
                        <span className="label">Layout:</span>
                        <span
                          className="value"
                          style={{
                            background: "#eef2ff",
                            color: "#6366f1",
                            padding: "4px 12px",
                            borderRadius: "12px",
                            fontSize: "13px",
                            fontWeight: "600",
                          }}
                        >
                          📐{" "}
                          {selectedImage.textLayout === "left"
                            ? "ซ้าย"
                            : selectedImage.textLayout === "right"
                            ? "ขวา"
                            : selectedImage.textLayout === "top"
                            ? "บน"
                            : selectedImage.textLayout === "bottom"
                            ? "ล่าง"
                            : selectedImage.textLayout === "center"
                            ? "กลาง"
                            : selectedImage.textLayout}
                        </span>
                      </div>
                    )}
                  </>
                )}

                {/* Gift Product Items inside modal */}
                {selectedImage.type === "gift" && selectedImage.giftOrder && selectedImage.giftOrder.items && (
                  <div
                    className="detail-row"
                    style={{
                      flexDirection: "column",
                      alignItems: "flex-start",
                      borderBottom: "1px solid #eee",
                      paddingBottom: "12px",
                      marginBottom: "12px",
                    }}
                  >
                    {/* Sender phone layout */}
                    {selectedImage.giftOrder.senderPhone && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          marginBottom: "12px",
                          padding: "10px 14px",
                          background: "linear-gradient(135deg, #fef3c7, #fde68a)",
                          borderRadius: "12px",
                          border: "1px solid #f59e0b",
                          width: "100%",
                          boxSizing: "border-box",
                        }}
                      >
                        <span style={{ fontSize: "18px" }}>📞</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "11px", color: "#92400e", fontWeight: "600" }}>เบอร์โทรผู้ส่ง</div>
                          <div style={{ fontSize: "16px", fontWeight: "700", color: "#78350f" }}>
                            {selectedImage.giftOrder.senderPhone}
                          </div>
                        </div>
                        <a
                          href={`tel:${selectedImage.giftOrder.senderPhone}`}
                          style={{
                            padding: "6px 14px",
                            background: "#16a34a",
                            color: "#fff",
                            borderRadius: "8px",
                            fontSize: "13px",
                            fontWeight: "600",
                            textDecoration: "none",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          📞 โทร
                        </a>
                      </div>
                    )}

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        width: "100%",
                        marginBottom: "8px",
                      }}
                    >
                      <span className="label">📦 รายการสินค้าทั้งหมด:</span>
                      {!isEditingGift ? (
                        <button
                          onClick={() => setIsEditingGift(true)}
                          style={{
                            padding: "4px 12px",
                            background: "#f59e0b",
                            color: "#fff",
                            border: "none",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: "600",
                            cursor: "pointer",
                          }}
                        >
                          ✏️ แก้ไขรายการ
                        </button>
                      ) : (
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            onClick={() => {
                              setIsEditingGift(false);
                              setEditGiftItems(selectedImage.giftOrder.items.map((i) => ({ ...i })));
                              setShowAddGiftItem(false);
                            }}
                            style={{
                              padding: "4px 10px",
                              background: "#94a3b8",
                              color: "#fff",
                              border: "none",
                              borderRadius: "8px",
                              fontSize: "12px",
                              fontWeight: "600",
                              cursor: "pointer",
                            }}
                          >
                            ยกเลิก
                          </button>
                          <button
                            onClick={async () => {
                              setSavingGiftItems(true);
                              try {
                                const itemId = selectedImage._id || selectedImage.id;
                                const response = await adminFetch(`${API_BASE_URL}/api/queue/${itemId}/gift-items`, {
                                  method: "PUT",
                                  body: JSON.stringify({ items: editGiftItems }),
                                });
                                if (response.ok) {
                                  const data = await response.json();
                                  setSelectedImage(data.queueItem);
                                  setEditGiftItems(data.queueItem.giftOrder.items.map((i) => ({ ...i })));
                                  setIsEditingGift(false);
                                  setShowAddGiftItem(false);
                                  fetchImages();
                                } else {
                                  alert("บันทึกไม่สำเร็จ");
                                }
                              } catch (err) {
                                console.error("Error saving gift items:", err);
                                alert("เกิดข้อผิดพลาด");
                              } finally {
                                setSavingGiftItems(false);
                              }
                            }}
                            disabled={savingGiftItems || editGiftItems.length === 0}
                            style={{
                              padding: "4px 10px",
                              background: "#22c55e",
                              color: "#fff",
                              border: "none",
                              borderRadius: "8px",
                              fontSize: "12px",
                              fontWeight: "600",
                              cursor: "pointer",
                              opacity: savingGiftItems || editGiftItems.length === 0 ? 0.5 : 1,
                            }}
                          >
                            {savingGiftItems ? "กำลังบันทึก..." : "✅ บันทึก"}
                          </button>
                        </div>
                      )}
                    </div>

                    <div style={{ width: "100%", background: "#f8fafc", borderRadius: "8px", padding: "12px" }}>
                      {(isEditingGift ? editGiftItems : selectedImage.giftOrder.items).map((giftItem, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "8px 0",
                            borderBottom:
                              idx < (isEditingGift ? editGiftItems : selectedImage.giftOrder.items).length - 1
                                ? "1px solid #e5e7eb"
                                : "none",
                          }}
                        >
                          <span style={{ fontSize: "14px", color: "#334155", fontWeight: "500", flex: 1 }}>
                            {giftItem.name}
                          </span>
                          <span style={{ fontSize: "14px", color: "#64748b", marginRight: isEditingGift ? "10px" : "0" }}>
                            x{giftItem.quantity} · {giftItem.price === 0 ? "ฟรี" : `฿${giftItem.price}`}
                          </span>
                          {isEditingGift && (
                            <button
                              onClick={() => setEditGiftItems((prev) => prev.filter((_, i) => i !== idx))}
                              style={{
                                width: "28px",
                                height: "28px",
                                background: "#ef4444",
                                color: "#fff",
                                border: "none",
                                borderRadius: "8px",
                                cursor: "pointer",
                                fontSize: "14px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              ✖
                            </button>
                          )}
                        </div>
                      ))}

                      {/* Total */}
                      <div
                        style={{
                          marginTop: "12px",
                          paddingTop: "12px",
                          borderTop: "2px solid #e5e7eb",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ fontSize: "15px", fontWeight: "700", color: "#1e293b" }}>รวมทั้งหมด</span>
                        <span style={{ fontSize: "16px", fontWeight: "700", color: "#8b5cf6" }}>
                          {isEditingGift
                            ? editGiftItems.reduce((s, i) => s + (i.price || 0) * (i.quantity || 1), 0) === 0
                              ? "ฟรี"
                              : `฿${editGiftItems.reduce((s, i) => s + (i.price || 0) * (i.quantity || 1), 0)}`
                            : selectedImage.price === 0
                            ? "ฟรี"
                            : `฿${selectedImage.price}`}
                        </span>
                      </div>

                      {/* Add new gift item */}
                      {isEditingGift && (
                        <div style={{ marginTop: "12px" }}>
                          {!showAddGiftItem ? (
                            <button
                              onClick={() => setShowAddGiftItem(true)}
                              style={{
                                width: "100%",
                                padding: "8px",
                                background: "#eef2ff",
                                color: "#6366f1",
                                border: "2px dashed #a5b4fc",
                                borderRadius: "8px",
                                cursor: "pointer",
                                fontSize: "13px",
                                fontWeight: "600",
                              }}
                            >
                              ➕ เพิ่มสินค้าจากรายการ
                            </button>
                          ) : (
                            <div
                              style={{
                                background: "#f0fdf4",
                                border: "1px solid #86efac",
                                borderRadius: "10px",
                                padding: "10px",
                                maxHeight: "200px",
                                overflowY: "auto",
                              }}
                            >
                              <div style={{ fontSize: "12px", color: "#166534", fontWeight: "600", marginBottom: "8px" }}>
                                เลือกสินค้าที่ต้องการเพิ่ม:
                              </div>
                              {giftSettings
                                .filter((gs) => !editGiftItems.some((eg) => eg.id === gs.id))
                                .map((gs) => (
                                  <button
                                    key={gs.id}
                                    onClick={() => {
                                      setEditGiftItems((prev) => [
                                        ...prev,
                                        {
                                          id: gs.id,
                                          name: gs.name,
                                          price: Number(gs.price) || 0,
                                          quantity: 1,
                                          image: gs.imageUrl || gs.image || "",
                                        },
                                      ]);
                                      setShowAddGiftItem(false);
                                    }}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "10px",
                                      width: "100%",
                                      padding: "8px",
                                      background: "#fff",
                                      border: "1px solid #d1fae5",
                                      borderRadius: "8px",
                                      cursor: "pointer",
                                      marginBottom: "4px",
                                      textAlign: "left",
                                    }}
                                  >
                                    {gs.imageUrl && (
                                      <img
                                        src={getImageUrl(gs.imageUrl)}
                                        alt={gs.name}
                                        style={{
                                          width: "32px",
                                          height: "32px",
                                          borderRadius: "6px",
                                          objectFit: "contain",
                                          background: "#f1f5f9",
                                        }}
                                      />
                                    )}
                                    <span style={{ flex: 1, fontSize: "13px", fontWeight: "500", color: "#1e293b" }}>
                                      {gs.name}
                                    </span>
                                    <span style={{ fontSize: "12px", color: "#64748b" }}>฿{gs.price}</span>
                                  </button>
                                ))}
                              <button
                                onClick={() => setShowAddGiftItem(false)}
                                style={{
                                  width: "100%",
                                  padding: "6px",
                                  background: "#f1f5f9",
                                  color: "#64748b",
                                  border: "none",
                                  borderRadius: "8px",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                  fontWeight: "600",
                                  marginTop: "4px",
                                }}
                              >
                                ปิด
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Extra common metadata fields */}
              <div className="detail-row">
                <span className="label">เวลาที่เลือก:</span>
                <span className="value">{selectedImage.time} วินาที</span>
              </div>
              <div className="detail-row">
                <span className="label">ราคา:</span>
                <span className="value">{selectedImage.price === 0 ? "ฟรี" : `฿${selectedImage.price}`}</span>
              </div>
              <div className="detail-row">
                <span className="label">ส่งเมื่อ:</span>
                <span className="value">{formatDate(selectedImage.createdAt)}</span>
              </div>

              {/* Resize OBS values */}
              <div className="detail-row" style={{ marginTop: "12px", borderTop: "1px solid #eee", paddingTop: "12px" }}>
                <span className="label" style={{ width: "100%" }}>ปรับขนาดแสดงผล (OBS):</span>
                <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "12px", color: "#666" }}>กว้าง (px)</label>
                    <input
                      type="number"
                      placeholder="Auto"
                      value={editWidth}
                      onChange={(e) => setEditWidth(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "6px",
                        border: "1px solid #ddd",
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "12px", color: "#666" }}>สูง (px)</label>
                    <input
                      type="number"
                      placeholder="Auto"
                      value={editHeight}
                      onChange={(e) => setEditHeight(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "6px",
                        border: "1px solid #ddd",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="approve-button" onClick={() => handleApprove(selectedImage._id || selectedImage.id)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                อนุมัติ
              </button>
              <button className="reject-button" onClick={() => handleReject(selectedImage._id || selectedImage.id)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                ปฏิเสธ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      <QueueHistoryModal
        showHistory={showHistory}
        setShowHistory={setShowHistory}
        historyItems={historyItems}
        giftSettings={giftSettings}
        getImageUrl={getImageUrl}
        handleRestoreToQueue={handleRestoreToQueue}
        renderSocialOnImage={renderSocialOnImage}
        formatDate={formatDate}
      />
    </div>
  );
}
