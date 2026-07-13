import React from "react";
import { Link } from "react-router-dom";
import "./EditProfileForm.css";

/**
 * Presentational Component for Shop Edit Profile.
 * Pure UI driven entirely by props with no local business logic or API interactions.
 */
export default function EditProfileForm({
  adminShopId,
  username,
  shopLogo,
  logoPreview,
  logoLoading,
  logoInputRef,
  shopDisplayName,
  isEditingName,
  setIsEditingName,
  nameInput,
  setNameInput,
  nameLoading,
  showEmojiPicker,
  setShowEmojiPicker,
  emojiPickerRef,
  isEditingShopId,
  setIsEditingShopId,
  newShopIdInput,
  setNewShopIdInput,
  shopIdLoading,
  currentPw,
  setCurrentPw,
  newPw,
  setNewPw,
  confirmPw,
  setConfirmPw,
  showCurrentPw,
  setShowCurrentPw,
  showNewPw,
  setShowNewPw,
  showConfirmPw,
  setShowConfirmPw,
  message,
  loading,
  handleLogoClick,
  handleLogoChange,
  handleCancelLogo,
  handleLogoUpload,
  handleSaveName,
  handleCancelEditName,
  handleSaveShopId,
  handleCancelEditShopId,
  handleChangePassword,
  handleLogout,
}) {
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <div className="ep-container">
      {/* Decorative background elements */}
      <div className="ep-blob ep-blob-1"></div>
      <div className="ep-blob ep-blob-2"></div>

      <div className="ep-glass-card">
        {/* Header */}
        <div className="ep-header">
          <Link to="/home" className="ep-btn-back" title="กลับหน้าหลัก">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h2 className="ep-header-title">โปรไฟล์ร้านค้า</h2>
        </div>

        {/* ===== SHOP LOGO SECTION ===== */}
        <div className="ep-profile-section">
          <div className="ep-avatar-wrapper" onClick={handleLogoClick} title="คลิกเพื่อเปลี่ยนโลโก้ร้าน">
            {logoPreview ? (
              <img
                src={logoPreview}
                alt="Shop Logo"
                className="ep-avatar-img"
              />
            ) : (
              <div className="ep-avatar-circle">{initials}</div>
            )}
            {/* Edit badge */}
            <div className="ep-avatar-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
          </div>

          {/* Hidden file input */}
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleLogoChange}
          />

          {/* Upload button (shows after selecting file) */}
          {shopLogo && (
            <div className="ep-logo-upload-actions">
              <button
                className="ep-btn-save ep-btn-save-logo"
                onClick={handleLogoUpload}
                disabled={logoLoading}
              >
                {logoLoading ? "กำลังอัปโหลด..." : "💾 บันทึกโลโก้"}
              </button>
              <button
                className="ep-btn-icon ep-btn-cancel ep-btn-cancel-logo"
                onClick={handleCancelLogo}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          )}

          <h2 className="ep-username">{username}</h2>

          {/* ===== SHOP SETTINGS CARDS ===== */}
          <div className="ep-shop-cards-container">
            {/* 1. Shop Display Name Card */}
            <div className="ep-shop-card">
              <div className="ep-shop-card-header">
                <div className="ep-shop-icon-wrapper">
                  <span>🏪</span>
                </div>
                <div className="ep-shop-card-title-group">
                  <h4>ชื่อร้านที่ลูกค้าเห็น</h4>
                  <p>ชื่อนี้จะแสดงบนหน้าจอหลักของลูกค้า เปลี่ยนได้ตลอดเวลา</p>
                </div>
              </div>

              <div className="ep-divider-dashed"></div>

              <div className="ep-shop-card-content">
                {isEditingName ? (
                  <div className="ep-shop-edit-wrapper" ref={emojiPickerRef}>
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="ep-shop-input"
                      placeholder="ชื่อร้าน (ใส่อีโมจิได้)"
                      maxLength="50"
                      autoFocus
                    />
                    <div className="ep-shop-action-buttons">
                      <button
                        className="ep-btn-emoji"
                        type="button"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        title="แทรกอิโมจิ"
                      >
                        😀
                      </button>
                      <button className="ep-btn-icon ep-btn-confirm" onClick={handleSaveName} disabled={nameLoading} title="บันทึก">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </button>
                      <button className="ep-btn-icon ep-btn-cancel" onClick={handleCancelEditName} disabled={nameLoading} title="ยกเลิก">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>

                    {showEmojiPicker && (
                      <div className="ep-emoji-picker-dropdown">
                        {["😀", "😂", "🥰", "😎", "🥺", "✨", "🔥", "❤️", "👍", "🙏", "🎉", "🍜", "☕", "🍺", "🍽️", "🎵"].map(emoji => (
                          <button
                            key={emoji}
                            className="ep-emoji-btn"
                            type="button"
                            title={emoji}
                            onClick={() => {
                              setNameInput(prev => prev + emoji);
                              setShowEmojiPicker(false);
                            }}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="ep-shop-display-pill blue-pill">
                    <span className="ep-shop-value-text" title={shopDisplayName || "ไม่ได้ระบุ"}>
                      {shopDisplayName || "ไม่ได้ระบุ"}
                    </span>
                    <button className="ep-btn-edit-circle" onClick={() => setIsEditingName(true)} title="แก้ไขชื่อร้านที่แสดงผล">
                      ✏️
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Shop ID Card */}
            <div className="ep-shop-card warning-card">
              <div className="ep-shop-card-header">
                <div className="ep-shop-icon-wrapper">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                  </svg>
                </div>
                <div className="ep-shop-card-title-group">
                  <h4>รหัสลิงก์ร้าน <br />(Shop ID)</h4>
                  <p className="ep-warning-text">
                    <span className="ep-warning-icon">⚠️</span> <strong>คำเตือน:</strong> หากเปลี่ยนรหัสลิงก์ จะต้องอัปเดต URL ใน OBS และ QR Code ใหม่ทั้งหมด
                  </p>
                </div>
              </div>

              <div className="ep-divider-dashed"></div>

              <div className="ep-shop-card-content">
                {isEditingShopId ? (
                  <div className="ep-shop-edit-wrapper">
                    <input
                      type="text"
                      value={newShopIdInput}
                      onChange={(e) => setNewShopIdInput(e.target.value)}
                      className="ep-shop-input"
                      placeholder="ภาษาอังกฤษหรือเลข"
                      maxLength="40"
                      autoFocus
                    />
                    <div className="ep-shop-action-buttons">
                      <button className="ep-btn-icon ep-btn-confirm" onClick={handleSaveShopId} disabled={shopIdLoading} title="บันทึก">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </button>
                      <button className="ep-btn-icon ep-btn-cancel" onClick={handleCancelEditShopId} disabled={shopIdLoading} title="ยกเลิก">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="ep-shop-display-pill red-pill">
                    <span className="ep-shop-value-text ep-shop-id-badge" title={adminShopId || "ไม่ได้ระบุ"}>
                      {adminShopId || "ไม่ได้ระบุ"}
                    </span>
                    <button className="ep-btn-edit-circle" onClick={() => setIsEditingShopId(true)} title="แก้ไขรหัสลิงก์ร้าน">
                      ✏️
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Change Password Form */}
        <div className="ep-form-container">
          <h3 className="ep-section-title">ตั้งค่าความปลอดภัย</h3>
          <form className="ep-form" onSubmit={handleChangePassword}>
            <div className="ep-input-group">
              <label>รหัสผ่านปัจจุบัน</label>
              <div className="ep-input-wrapper password-toggle-wrapper">
                <svg className="ep-input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <input
                  type={showCurrentPw ? "text" : "password"}
                  placeholder="กรอกรหัสผ่านปัจจุบันของคุณ"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  className="ep-input-field"
                />
                <span className="ep-toggle-password" onClick={() => setShowCurrentPw(!showCurrentPw)} title={showCurrentPw ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}>
                  <i className={`fas ${showCurrentPw ? "fa-eye-slash" : "fa-eye"}`}></i>
                </span>
              </div>
            </div>

            <div className="ep-input-group">
              <label>รหัสผ่านใหม่</label>
              <div className="ep-input-wrapper password-toggle-wrapper">
                <svg className="ep-input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <input
                  type={showNewPw ? "text" : "password"}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="ep-input-field"
                />
                <span className="ep-toggle-password" onClick={() => setShowNewPw(!showNewPw)} title={showNewPw ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}>
                  <i className={`fas ${showNewPw ? "fa-eye-slash" : "fa-eye"}`}></i>
                </span>
              </div>
            </div>

            <div className="ep-input-group">
              <label>ยืนยันรหัสผ่านใหม่</label>
              <div className="ep-input-wrapper password-toggle-wrapper">
                <svg className="ep-input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
                <input
                  type={showConfirmPw ? "text" : "password"}
                  placeholder="ยืนยันรหัสผ่านใหม่อีกครั้ง"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  className="ep-input-field"
                />
                <span className="ep-toggle-password" onClick={() => setShowConfirmPw(!showConfirmPw)} title={showConfirmPw ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}>
                  <i className={`fas ${showConfirmPw ? "fa-eye-slash" : "fa-eye"}`}></i>
                </span>
              </div>
            </div>

            {/* Notification Message */}
            <div className={`ep-message-alert ${message.text ? 'ep-message-show' : ''} ep-message-${message.type}`}>
              {message.type === 'success' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              ) : message.type === 'error' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
              ) : null}
              <span>{message.text}</span>
            </div>

            <button type="submit" className="ep-btn-save" disabled={loading}>
              {loading ? <span className="ep-loader">กำลังบันทึก...</span> : "อัปเดตรหัสผ่าน"}
            </button>
          </form>
        </div>

        {/* Footer Actions */}
        <div className="ep-footer">
          <button className="ep-btn-logout" onClick={handleLogout}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            ออกจากระบบ
          </button>
        </div>
      </div>
    </div>
  );
}
