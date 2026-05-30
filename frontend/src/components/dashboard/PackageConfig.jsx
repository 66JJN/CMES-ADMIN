import React, { useState, useEffect, useContext } from 'react';
import { HomeContext } from '../../contexts/HomeContext';
import { ShopContext } from '../../contexts/ShopContext';
import { API_BASE_URL } from '../../config/apiConfig';
import adminFetch from '../../config/authFetch';
import Card from '../ui/Card';
import Button from '../ui/Button';

/**
 * PackageConfig dashboard component.
 * Displays package setup forms (mode togglers, minutes, seconds, price inputs)
 * and payment QR uploader preview panels.
 */
export default function PackageConfig({ 
  isCollapsed, 
  onToggleVisibility 
}) {
  const { socket } = useContext(ShopContext);
  const {
    systemOn,
    mode, setMode,
    minute, setMinute,
    second, setSecond,
    price, setPrice,
    paymentQrUrl, setPaymentQrUrl,
    showToast
  } = useContext(HomeContext);

  // ===== Local state for QR uploader interactions =====
  const [paymentQrFile, setPaymentQrFile] = useState(null);
  const [paymentQrPreview, setPaymentQrPreview] = useState(null);
  const [uploadingPaymentQr, setUploadingPaymentQr] = useState(false);

  // Fetch payment QR uploader config on mount
  useEffect(() => {
    const loadPaymentQr = async () => {
      try {
        const res = await adminFetch(`${API_BASE_URL}/api/config/payment-qr`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.paymentQrUrl) {
            setPaymentQrUrl(data.paymentQrUrl);
          }
        }
      } catch (error) {
        console.error("[PackageConfig] Failed to load payment QR:", error);
      }
    };
    loadPaymentQr();
  }, [setPaymentQrUrl]);

  // QR Code image select handler
  const handlePaymentQrFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPaymentQrFile(file);
      setPaymentQrPreview(URL.createObjectURL(file));
    }
  };

  // Upload Payment QR to server
  const handleUploadPaymentQr = async () => {
    if (!paymentQrFile) {
      showToast("กรุณาเลือกรูปภาพ QR Code ก่อน", "error");
      return;
    }
    setUploadingPaymentQr(true);
    try {
      const formData = new FormData();
      formData.append('paymentQr', paymentQrFile);

      const res = await adminFetch(`${API_BASE_URL}/api/config/payment-qr`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (data.success) {
        setPaymentQrUrl(data.paymentQrUrl);
        setPaymentQrFile(null);
        setPaymentQrPreview(null);
        showToast("✅ อัปโหลด QR Code ชำระเงินสำเร็จ", "success");
      } else {
        showToast("❌ " + (data.message || "อัปโหลดไม่สำเร็จ"), "error");
      }
    } catch (error) {
      console.error("[PackageConfig] Upload payment QR failed:", error);
      showToast("❌ เกิดข้อผิดพลาดในการอัปโหลด", "error");
    } finally {
      setUploadingPaymentQr(false);
    }
  };

  // Save timing package setup
  const handleSave = () => {
    if (!minute && !second) {
      showToast("กรุณากรอกเวลาอย่างน้อย 1 ช่อง", "error");
      return;
    }
    if (!price && mode !== "birthday") {
      showToast("กรุณากรอกราคา", "error");
      return;
    }

    const totalSeconds = (parseInt(minute) || 0) * 60 + (parseInt(second) || 0);
    const durationDisplay = `${minute ? minute + " นาที" : ""}${second ? (minute ? " " : "") + second + " วินาที" : ""}`;

    const packageData = {
      id: Date.now(),
      mode,
      date: new Date().toLocaleString(),
      duration: durationDisplay,
      time: totalSeconds,
      price: mode === "birthday" ? 0 : price,
    };

    if (!socket || !socket.connected) {
      showToast("ไม่สามารถบันทึกได้: ยังไม่ได้เชื่อมต่อ Realtime Server กรุณารอสักครู่แล้วลองใหม่", "error");
      return;
    }
    socket.emit("addPackage", packageData);
    setMinute("");
    setSecond("");
    setPrice("");
    showToast("บันทึกแพ็คเกจสำเร็จ", "success");
  };

  return (
    <Card 
      type="setting" 
      className={`package-settings-card ${isCollapsed ? 'card-collapsed' : ''}`}
    >
      <div className="card-drag-handle" title="กดค้างแล้วลากเพื่อย้ายตำแหน่ง">
        <span className="drag-icon">⠿</span>
        <h3 className="card-drag-title">ตั้งค่าแพ็คเกจ</h3>
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
          <div className="mode-select-row">
            <button 
              className={`mode-btn-minimal ${mode === "image" ? "active" : ""}`} 
              onClick={() => setMode("image")} 
              disabled={!systemOn}
            >
              รูปภาพ
            </button>
            <button 
              className={`mode-btn-minimal ${mode === "text" ? "active" : ""}`} 
              onClick={() => setMode("text")} 
              disabled={!systemOn}
            >
              ข้อความ
            </button>
            <button 
              className={`mode-btn-minimal ${mode === "birthday" ? "active" : ""}`} 
              onClick={() => setMode("birthday")} 
              disabled={!systemOn}
            >
              วันเกิด
            </button>
          </div>

          <div className="input-row-minimal">
            <input 
              type="number" 
              min="1" 
              max="59" 
              placeholder="นาที" 
              value={minute} 
              onChange={(e) => setMinute(e.target.value)} 
              disabled={!systemOn} 
              className="input-minimal" 
            />
            <input 
              type="number" 
              min="1" 
              max="59" 
              placeholder="วินาที" 
              value={second} 
              onChange={(e) => setSecond(e.target.value)} 
              disabled={!systemOn} 
              className="input-minimal" 
            />
            <input 
              type="number" 
              min="1" 
              placeholder="ราคา (บาท)" 
              value={mode === "birthday" ? "" : price} 
              onChange={(e) => setPrice(e.target.value)} 
              disabled={!systemOn || mode === "birthday"} 
              className="input-minimal" 
            />
          </div>

          <Button 
            onClick={handleSave} 
            disabled={!systemOn} 
            className="save-btn-minimal"
          >
            บันทึกแพ็คเกจ
          </Button>

          {/* ===== Payment QR Upload controls ===== */}
          <div className="payment-qr-upload-section">
            <div className="payment-qr-header">
              <span className="payment-qr-title">💳 QR Code ชำระเงิน</span>
              <small className="payment-qr-subtitle">ภาพนี้จะแสดงในหน้าชำระเงินของลูกค้า</small>
            </div>

            {(paymentQrPreview || paymentQrUrl) && (
              <div className="payment-qr-preview-container">
                <img 
                  src={paymentQrPreview || paymentQrUrl} 
                  alt="QR Code ชำระเงิน" 
                  className="payment-qr-preview-img" 
                />
                <span className="payment-qr-status">
                  {paymentQrPreview ? "📷 ภาพใหม่" : "✅ ภาพปัจจุบัน"}
                </span>
              </div>
            )}

            <div className="payment-qr-actions">
              <label className="payment-qr-file-label">
                📁 เลือกรูปภาพ
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handlePaymentQrFileChange} 
                  className="hidden-file-input"
                />
              </label>
              <Button 
                onClick={handleUploadPaymentQr} 
                disabled={!paymentQrFile || uploadingPaymentQr} 
                className="payment-qr-upload-btn"
              >
                {uploadingPaymentQr ? "⏳ กำลังอัปโหลด..." : "☁️ อัปโหลด"}
              </Button>
            </div>

            {!paymentQrUrl && !paymentQrPreview && (
              <small className="payment-qr-hint">
                ⚠️ ยังไม่มีภาพ QR Code ชำระเงิน ระบบจะแสดงภาพเริ่มต้น
              </small>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
