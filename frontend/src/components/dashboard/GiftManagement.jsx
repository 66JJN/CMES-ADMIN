/**
 * GiftManagement — Presentational Component สำหรับการตั้งค่าของขวัญและสินค้า
 * แยก Logic ออกไปไว้ที่ hooks/useGiftManagement.js
 */
import React from "react";
import BackNavLink from "../ui/BackNavLink";
import useGiftManagement from "../../hooks/useGiftManagement";
import "./GiftManagement.css";

export default function GiftManagement() {
  const {
    items,
    tableCount,
    setTableCount,
    loading,
    saving,
    message,
    form,
    previewUrl,
    fileInputRef,
    loadSettings,
    resolveImageSrc,
    handleInputChange,
    handleAddItem,
    handleDelete,
    handleTableUpdate,
    handleFileChange,
    clearLocalImage
  } = useGiftManagement();

  return (
    <div className="giftsetting-shell">
      <header className="giftsetting-hero">
        <div className="hero-brand-group">
          <BackNavLink className="hero-back-btn" />
          <div className="hero-info">
            <p className="eyebrow">CMES ADMIN</p>
            <h1>ตั้งค่าส่งของขวัญ</h1>
            <p className="subtitle">กำหนดจำนวนโต๊ะและสินค้าที่พร้อมให้ผู้ใช้เลือก</p>
          </div>
        </div>
        <div className="hero-actions">
          <button className="ghost-button" onClick={loadSettings}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
            </svg>
            รีเฟรชข้อมูล
          </button>
        </div>
      </header>

      <main className="giftsetting-layout">
        <section className="giftsetting-panel">
          <div className="panel-head">
            <div>
              <h2>จำนวนโต๊ะที่รองรับ</h2>
              <p>กำหนดเลขโต๊ะสูงสุดสำหรับคำสั่งซื้อของผู้ใช้</p>
            </div>
            <button className="primary-button" onClick={handleTableUpdate}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
              </svg>
              บันทึก
            </button>
          </div>
          <div className="table-config">
            <input
              type="number"
              min="1"
              value={tableCount}
              onChange={(e) => setTableCount(e.target.value)}
            />
            <span className="helper-text">ปัจจุบัน {tableCount} โต๊ะ</span>
          </div>
        </section>

        <section className="giftsetting-panel">
          <div className="panel-head">
            <div>
              <h2>เพิ่มรายการสินค้า</h2>
              <p>กรอกข้อมูลสินค้าเพื่อให้ผู้ใช้เลือกส่งของขวัญ</p>
            </div>
            {saving && <span className="chip">กำลังบันทึก...</span>}
          </div>
          <form className="gift-form" onSubmit={handleAddItem}>
            <div className="form-grid">
              <div className="form-field">
                <label>ชื่อสินค้า</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="เช่น ช่อดอกไม้"
                />
              </div>
              <div className="form-field">
                <label>ราคา (บาท)</label>
                <input
                  type="number"
                  min="0"
                  value={form.price}
                  onChange={(e) => handleInputChange("price", e.target.value)}
                  placeholder="เช่น 150 (ใส่ 0 สำหรับแจกฟรี)"
                />
              </div>
              <div className="form-field file-field">
                <label>อัปโหลดรูปจากเครื่อง</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                />
                <small className="helper-text">เลือกรูปจากเครื่องได้หนึ่งรูป ระบบจะอัปโหลดให้อัตโนมัติ</small>
              </div>
            </div>
            {previewUrl && (
              <div className="image-preview">
                <img src={previewUrl} alt="ตัวอย่างรูป" />
                <button type="button" className="ghost-button" onClick={clearLocalImage}>
                  ล้างรูป
                </button>
              </div>
            )}
            <label>รายละเอียด</label>
            <textarea
              rows="3"
              value={form.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="คำอธิบายเพิ่มเติม"
            />
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? (
                <>กำลังบันทึก...</>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  เพิ่มสินค้า
                </>
              )}
            </button>
          </form>
        </section>

        <section className="giftsetting-panel">
          <div className="panel-head">
            <div>
              <h2>รายการสินค้าทั้งหมด ({items.length})</h2>
              <p>จัดการสินค้าให้พร้อมใช้งานกับระบบผู้ใช้</p>
            </div>
          </div>
          {loading ? (
            <div className="panel-empty">กำลังโหลด...</div>
          ) : items.length === 0 ? (
            <div className="panel-empty">ยังไม่มีสินค้า</div>
          ) : (
            <div className="gift-items-table">
              {items.map((item) => (
                <div key={item.id} className="gift-row">
                  <div className="gift-row-main">
                    {item.imageUrl ? (
                      <img src={resolveImageSrc(item.imageUrl)} alt={item.name} className="gift-thumb" />
                    ) : (
                      <div className="gift-thumb placeholder">
                        {item.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                    )}
                    <div>
                      <strong>{item.name}</strong>
                      {item.description && <p>{item.description}</p>}
                    </div>
                  </div>
                  <div className="gift-row-actions">
                    <span className="price">{item.price === 0 ? 'ฟรี' : `฿${item.price}`}</span>
                    <button className="danger-button" onClick={() => handleDelete(item.id)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                      </svg>
                      ลบ
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {message && <div className="giftsetting-alert">{message}</div>}
      </main>
    </div>
  );
}
