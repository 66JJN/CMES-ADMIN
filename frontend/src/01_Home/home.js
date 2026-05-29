import React, { useState, useEffect, useContext, Suspense, lazy } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ShopContext } from "../contexts/ShopContext"; // 🔥 Multi-tenant Context
import { API_BASE_URL, USER_FRONTEND_URL } from "../config/apiConfig";
import adminFetch from "../config/authFetch";
import "./home.css";

// Import Reusable UI Components
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Select from "../components/ui/Select";
import ErrorBoundary from "../components/ui/ErrorBoundary";

// Import Context Provider
import { HomeContext, HomeProvider } from "../contexts/HomeContext";

// Import Custom Hooks
import useDashboardSocket from "../hooks/useDashboardSocket";
import useRankingStats from "../hooks/useRankingStats";
import useCardReorder from "../hooks/useCardReorder";

// Import date utilities
import { getTodayStr, getCurrentMonthStr, getCurrentYearStr } from "../utils/dateHelpers";

// Lazy-loaded heavy modules
const LazyIncomeStats = lazy(() => import("./IncomeStats"));
const LazyOBSControl = lazy(() => import("../10_OBSControl/OBSControl"));
const LazyToast = lazy(() => import("./Toast"));


// ฟังก์ชันจัดรูปแบบตัวเลขเป็นสกุลเงินไทย (เช่น 1,000)
const formatCurrency = (value) => Number(value || 0).toLocaleString("th-TH");

// ฟังก์ชันจัดรูปแบบวันที่และเวลาเป็นภาษาไทย
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
 * Main Home component wrapper implementing the local HomeProvider.
 */
function Home() {
  const { socket, shopId } = useContext(ShopContext);

  return (
    <HomeProvider socket={socket} shopId={shopId}>
      <HomeContent />
    </HomeProvider>
  );
}

/**
 * Clean dashboard view using extracted business states, hooks, and modular UI cards.
 */
function HomeContent() {
  const navigate = useNavigate();
  const location = useLocation();

  // Retrieve global states and configurations from Context
  const {
    socket,
    shopId,
    systemOn,
    enableImage,
    enableText,
    enableGift,
    enableBirthday,
    birthdaySpendingRequirement, setBirthdaySpendingRequirement,
    mode, setMode,
    minute, setMinute,
    second, setSecond,
    price, setPrice,
    topRanks,
    totalRankers, setTotalRankers,
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
    showIncomeStats, setShowIncomeStats,
    showQrModal, setShowQrModal,
    showObsModal, setShowObsModal,
    showPerksModal, setShowPerksModal,
    showAllRanks, setShowAllRanks,
    allRanks, setAllRanks,
    allRanksLoaded, setAllRanksLoaded,
    fetchingAllRanks, setFetchingAllRanks,
    allRankError, setAllRankError,
    shopProfile, setShopProfile,
    perks, setPerks,
    editingPerkIndex, setEditingPerkIndex,
    perkInputValue, setPerkInputValue,
    savingPerks, setSavingPerks,
    paymentQrUrl, setPaymentQrUrl,
    toastConfig, setToastConfig, showToast
  } = useContext(HomeContext);

  const adminId = localStorage.getItem("adminId") || "default-admin";
  const adminUsername = localStorage.getItem("adminUsername") || "Admin";

  // Bind custom business hooks
  const {
    handleToggleSystem,
    handleToggleImage,
    handleToggleText,
    handleToggleGift,
    handleToggleBirthday
  } = useDashboardSocket();

  const {
    loadTopRanks,
    loadRankingSummary,
    loadBirthdayRequirement,
    handleSaveBirthdayRequirement
  } = useRankingStats();

  const {
    cardOrder,
    cardVisibility,
    draggedCard,
    dragOverCard,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    toggleCardVisibility
  } = useCardReorder();

  // Fetch shop profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await adminFetch(`${API_BASE_URL}/api/shop/profile`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.shop) {
            setShopProfile({
              name: data.shop.name || adminUsername,
              logo: data.shop.logo || null
            });
          }
        }
      } catch (err) {
        console.warn("[Home] Failed to load shop profile:", err.message);
      }
    };
    fetchProfile();
  }, [shopId, location.key, adminUsername, setShopProfile]);

  // ===== Local page states (Modal copy triggers & Payment QR previews) =====
  const [copiedImage, setCopiedImage] = useState(false);
  const [copiedRanking, setCopiedRanking] = useState(false);
  const [copiedWheel, setCopiedWheel] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");

  const [paymentQrFile, setPaymentQrFile] = useState(null);
  const [paymentQrPreview, setPaymentQrPreview] = useState(null);
  const [uploadingPaymentQr, setUploadingPaymentQr] = useState(false);

  // ===== Fetch Payment QR on mount =====
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
        console.error("[Home] Failed to load payment QR:", error);
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
      console.error("[Home] Upload payment QR failed:", error);
      showToast("❌ เกิดข้อผิดพลาดในการอัปโหลด", "error");
    } finally {
      setUploadingPaymentQr(false);
    }
  };

  // Perks handlers
  const handleOpenPerksModal = () => setShowPerksModal(true);

  const handleClosePerksModal = () => {
    setShowPerksModal(false);
    setEditingPerkIndex(null);
    setPerkInputValue("");
  };

  const handleEditPerk = (index) => {
    setEditingPerkIndex(index);
    setPerkInputValue(perks[index]);
  };

  const handleSavePerk = () => {
    if (!perkInputValue.trim()) {
      showToast("กรุณากรอกข้อความสิทธิพิเศษ", "error");
      return;
    }
    const newPerks = [...perks];
    newPerks[editingPerkIndex] = perkInputValue.trim();
    setPerks(newPerks);
    setEditingPerkIndex(null);
    setPerkInputValue("");
  };

  const handleCancelEditPerk = () => {
    setEditingPerkIndex(null);
    setPerkInputValue("");
  };

  const handleAddPerk = () => {
    if (!perkInputValue.trim()) {
      showToast("กรุณากรอกข้อความสิทธิพิเศษ", "error");
      return;
    }
    setPerks([...perks, perkInputValue.trim()]);
    setPerkInputValue("");
  };

  const handleDeletePerk = (index) => {
    if (window.confirm("ต้องการลบสิทธิพิเศษนี้หรือไม่?")) {
      const newPerks = perks.filter((_, i) => i !== index);
      setPerks(newPerks);
    }
  };

  const handleSaveAllPerks = async () => {
    if (perks.length === 0) {
      showToast("ต้องมีสิทธิพิเศษอย่างน้อย 1 รายการ", "error");
      return;
    }

    setSavingPerks(true);
    try {
      const res = await adminFetch(`${API_BASE_URL}/api/config/perks`, {
        method: "POST",
        body: JSON.stringify({ perks })
      });

      if (res.ok) {
        if (socket) {
          console.log("[Admin] Broadcasting perks update via Socket.IO:", perks.length, "items");
          socket.emit("adminUpdatePerks", { perks });
        }
        showToast("✅ บันทึกสิทธิพิเศษสำเร็จ\n\nการเปลี่ยนแปลงจะแสดงแบบ Real-time บนหน้า User ทันที", "success");
        handleClosePerksModal();
      } else {
        showToast("เกิดข้อผิดพลาดในการบันทึก", "error");
      }
    } catch (error) {
      console.error("[Admin] Failed to save perks:", error);
      showToast("เกิดข้อผิดพลาดในการบันทึก", "error");
    } finally {
      setSavingPerks(false);
    }
  };

  // Save new timing packages
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

  // Broadcast public displays config
  const handleSetPublicRankingType = (type) => {
    if (!socket) return;
    console.log("[Admin] Broadcasting public ranking type:", type);
    socket.emit("setPublicRankingType", { type });
  };

  // Generate merchant QR Code link
  const generateQRCode = () => {
    const shopParam = shopId || localStorage.getItem('shopId') || 'CMES ADMIN';
    const userAppUrl = `${USER_FRONTEND_URL}/?shopId=${shopParam}`;
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(userAppUrl)}&format=png&ecc=H`;
    setQrCodeUrl(qrApiUrl);
    setShowQrModal(true);
  };

  // Rankings modal paging details
  const handleOpenAllRanks = async () => {
    setShowAllRanks(true);
    if (allRanksLoaded || fetchingAllRanks) return;

    setFetchingAllRanks(true);
    setAllRankError("");

    try {
      const params = new URLSearchParams({
        limit: "500",
        type: rankingType
      });
      if (rankingType === "daily" && selectedDate) params.set("date", selectedDate);
      if (rankingType === "monthly" && selectedMonth) params.set("month", selectedMonth);
      if (rankingType === "alltime" && selectedYear) params.set("year", selectedYear);

      const res = await adminFetch(`${API_BASE_URL}/api/rankings?${params}`);
      if (!res.ok) throw new Error("FAILED");
      const data = await res.json();
      if (!data.success) throw new Error("FAILED");

      setAllRanks(data.ranks || []);
      setAllRanksLoaded(true);
      setTotalRankers(data.total ?? totalRankers);
    } catch (err) {
      setAllRankError("ไม่สามารถโหลดอันดับทั้งหมดได้");
    } finally {
      setFetchingAllRanks(false);
    }
  };

  const handleCloseAllRanks = () => setShowAllRanks(false);

  const modalRanks = allRanks.length ? allRanks : topRanks;

  // Mount listeners on start
  useEffect(() => {
    loadTopRanks();
    loadRankingSummary();
    loadBirthdayRequirement();
  }, [loadTopRanks, loadRankingSummary, loadBirthdayRequirement]);

  useEffect(() => {
    setAllRanksLoaded(false);
    setAllRanks([]);
    loadTopRanks();
    loadRankingSummary();
  }, [rankingType, rankLimit, selectedDate, selectedMonth, selectedYear, loadTopRanks, loadRankingSummary, setAllRanksLoaded, setAllRanks]);

  // Load perks on mount
  useEffect(() => {
    const loadPerks = async () => {
      try {
        const res = await adminFetch(`${API_BASE_URL}/api/config/perks`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.perks && data.perks.length > 0) {
            setPerks(data.perks);
          }
        }
      } catch (error) {
        console.error("[Home] Failed to load perks:", error);
      }
    };
    loadPerks();
  }, [setPerks]);

  return (
    <div className="admin-home-minimal">
      {/* ===== Header - Brand Navigation panel ===== */}
      <header className="admin-header-minimal">
        <div className="brand-minimal">
          <div className="brand-title-container" title={shopId || "CMES ADMIN"}>
            <div className={`brand-title-content ${(shopId || "CMES ADMIN").length > 15 ? 'marquee' : ''}`}>
              <span className="brand-title">{shopId || "CMES ADMIN"}</span>
              {(shopId || "CMES ADMIN").length > 15 && <span className="brand-title">{shopId || "CMES ADMIN"}</span>}
            </div>
          </div>
        </div>
        <nav className="nav-minimal">
          <a href="/TimeHistory">ประวัติการตั้งเวลา</a>
          <a href="/image-queue">ตรวจสอบรูปภาพ</a>
          <a href="/report">รายงาน</a>
          <a href="/check-history">ประวัติการตรวจสอบ</a>
          <a href="/lucky-wheel">วงล้อเสี่ยงดวง</a>
          <a href="/gift-setting">ตั้งค่าส่งของขวัญ</a>
          <a href="#!" onClick={(e) => { e.preventDefault(); setShowObsModal(true); }}>🎥 OBS Links</a>
        </nav>
        <div className="flex items-center" style={{ gap: '15px' }}>
          <button onClick={generateQRCode} title="QR Code ร้านค้า" className="btn-qr-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <rect x="7" y="7" width="3" height="3"></rect>
              <rect x="14" y="7" width="3" height="3"></rect>
              <rect x="7" y="14" width="3" height="3"></rect>
              <rect x="14" y="14" width="3" height="3"></rect>
            </svg>
            ลิงก์ & QR Code
          </button>
          <button
            onClick={() => navigate("/edit-profile")}
            title={shopProfile.name}
            className={`btn-avatar ${shopProfile.logo ? 'btn-avatar-bg-transparent' : 'btn-avatar-bg-default'}`}
          >
            {shopProfile.logo ? (
              <img
                src={shopProfile.logo.startsWith('http') ? shopProfile.logo : `${API_BASE_URL}${shopProfile.logo.startsWith('/') ? '' : '/'}${shopProfile.logo}`}
                alt="Shop Logo"
                className="avatar-img"
              />
            ) : (
              (shopProfile.name || adminUsername || "JJ").slice(0, 2).toUpperCase()
            )}
          </button>
        </div>
      </header>

      <main className="admin-main-minimal">
        {/* ===== System Config switch controls ===== */}
        <div className="system-status-row">
          <span className="system-label">สถานะระบบ:</span>
          <div className={`switch-minimal ${systemOn ? "on" : "off"}`} onClick={handleToggleSystem}>
            <div className="switch-dot"></div>
          </div>
          <span className={`system-status-text ${systemOn ? "on" : "off"}`}>
            {systemOn ? "เปิด" : "ปิด"}
          </span>
        </div>

        {!systemOn && (
          <div className="system-off-msg-minimal">
            ระบบถูกปิด ฝั่งผู้ใช้จะไม่สามารถใช้งานได้
          </div>
        )}

        {/* ===== Symmetrical Card layout container ===== */}
        <div className="three-box-container">
          {cardOrder.map(cardId => {
            const isCollapsed = !cardVisibility[cardId];
            const isDragOver = dragOverCard === cardId && draggedCard !== cardId;
            const cardWrapperClass = `card-drag-wrapper ${isDragOver ? 'drag-over' : ''} ${draggedCard === cardId ? 'dragging' : ''} ${isCollapsed ? 'collapsed' : ''}`;

            if (cardId === 'feature') return (
              <div
                key="feature"
                className={cardWrapperClass}
                draggable
                onDragStart={(e) => handleDragStart(e, 'feature')}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, 'feature')}
                onDrop={(e) => handleDrop(e, 'feature')}
              >
                <Card type="panel" className={isCollapsed ? 'card-collapsed' : ''}>
                  <div className="card-drag-handle" title="กดค้างแล้วลากเพื่อย้ายตำแหน่ง">
                    <span className="drag-icon">⠿</span>
                    <h3>ฟังก์ชันต่างๆ</h3>
                    <button className="card-eye-btn" onClick={(e) => { e.stopPropagation(); toggleCardVisibility('feature'); }} title={isCollapsed ? 'แสดง' : 'ซ่อน'}>
                      {isCollapsed ? '👁‍🗨' : '👁'}
                    </button>
                  </div>
                  {isCollapsed ? null : (
                    <div className="function-toggle-column">
                      <div className="toggle-card">
                        <span>ฟังก์ชันส่งรูปภาพ</span>
                        <button className={`toggle-btn-minimal${enableImage ? " on" : " off"}`} onClick={handleToggleImage} disabled={!systemOn}>
                          {enableImage ? "เปิด" : "ปิด"}
                        </button>
                      </div>

                      <div className="toggle-card">
                        <span>ฟังก์ชันข้อความ</span>
                        <button className={`toggle-btn-minimal${enableText ? " on" : " off"}`} onClick={handleToggleText} disabled={!systemOn}>
                          {enableText ? "เปิด" : "ปิด"}
                        </button>
                      </div>

                      <div className="toggle-card">
                        <span>ฟังก์ชันส่งของขวัญ</span>
                        <button className={`toggle-btn-minimal${enableGift ? " on" : " off"}`} onClick={handleToggleGift} disabled={!systemOn}>
                          {enableGift ? "เปิด" : "ปิด"}
                        </button>
                      </div>

                      <div className="toggle-card">
                        <span>ฟังก์ชันอวยพรวันเกิด</span>
                        <button className={`toggle-btn-minimal${enableBirthday ? " on" : " off"}`} onClick={handleToggleBirthday} disabled={!systemOn}>
                          {enableBirthday ? "เปิด" : "ปิด"}
                        </button>
                      </div>

                      <div className="toggle-card" style={{ flexDirection: "column", alignItems: "flex-start", gap: "8px" }}>
                        <span>ยอดใช้จ่ายขั้นต่ำสำหรับวันเกิด (บาท)</span>
                        <div className="flex w-full" style={{ gap: "8px" }}>
                          <input
                            type="number"
                            min="0"
                            placeholder="ยอดเงิน"
                            value={birthdaySpendingRequirement}
                            onChange={(e) => setBirthdaySpendingRequirement(e.target.value)}
                            disabled={!systemOn}
                            className="input-minimal"
                            style={{ flex: 1, padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "14px" }}
                          />
                          <Button onClick={handleSaveBirthdayRequirement} disabled={!systemOn} style={{ padding: "8px 16px" }}>
                            บันทึก
                          </Button>
                        </div>
                        <small style={{ color: "#64748b", fontSize: "12px" }}>
                          ผู้ใช้ต้องใช้จ่ายครบจำนวนนี้ก่อนจึงจะใช้ฟีเจอร์วันเกิดฟรีได้
                        </small>
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            );

            if (cardId === 'package') return (
              <div
                key="package"
                className={cardWrapperClass}
                draggable
                onDragStart={(e) => handleDragStart(e, 'package')}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, 'package')}
                onDrop={(e) => handleDrop(e, 'package')}
              >
                <Card type="setting" className={isCollapsed ? 'card-collapsed' : ''}>
                  <div className="card-drag-handle" title="กดค้างแล้วลากเพื่อย้ายตำแหน่ง">
                    <span className="drag-icon">⠿</span>
                    <h2>ตั้งค่าแพ็คเกจ</h2>
                    <button className="card-eye-btn" onClick={(e) => { e.stopPropagation(); toggleCardVisibility('package'); }} title={isCollapsed ? 'แสดง' : 'ซ่อน'}>
                      {isCollapsed ? '👁‍🗨' : '👁'}
                    </button>
                  </div>
                  {isCollapsed ? null : (
                    <>
                      <div className="mode-select-row">
                        <button className={`mode-btn-minimal${mode === "image" ? " active" : ""}`} onClick={() => setMode("image")} disabled={!systemOn}>รูปภาพ</button>
                        <button className={`mode-btn-minimal${mode === "text" ? " active" : ""}`} onClick={() => setMode("text")} disabled={!systemOn}>ข้อความ</button>
                        <button className={`mode-btn-minimal${mode === "birthday" ? " active" : ""}`} onClick={() => setMode("birthday")} disabled={!systemOn}>วันเกิด</button>
                      </div>

                      <div className="input-row-minimal">
                        <input type="number" min="1" max="59" placeholder="นาที" value={minute} onChange={(e) => setMinute(e.target.value)} disabled={!systemOn} className="input-minimal" />
                        <input type="number" min="1" max="59" placeholder="วินาที" value={second} onChange={(e) => setSecond(e.target.value)} disabled={!systemOn} className="input-minimal" />
                        <input type="number" min="1" placeholder="ราคา (บาท)" value={price} onChange={(e) => setPrice(e.target.value)} disabled={!systemOn} className="input-minimal" />
                      </div>

                      <Button onClick={handleSave} disabled={!systemOn} className="save-btn-minimal">
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
                            <img src={paymentQrPreview || paymentQrUrl} alt="QR Code ชำระเงิน" className="payment-qr-preview-img" />
                            <span className="payment-qr-status">{paymentQrPreview ? "📷 ภาพใหม่" : "✅ ภาพปัจจุบัน"}</span>
                          </div>
                        )}

                        <div className="payment-qr-actions">
                          <label className="payment-qr-file-label">
                            📁 เลือกรูปภาพ
                            <input type="file" accept="image/*" onChange={handlePaymentQrFileChange} style={{ display: "none" }} />
                          </label>
                          <Button onClick={handleUploadPaymentQr} disabled={!paymentQrFile || uploadingPaymentQr} className="payment-qr-upload-btn">
                            {uploadingPaymentQr ? "⏳ กำลังอัปโหลด..." : "☁️ อัปโหลด"}
                          </Button>
                        </div>

                        {!paymentQrUrl && !paymentQrPreview && (
                          <small className="payment-qr-hint">⚠️ ยังไม่มีภาพ QR Code ชำระเงิน ระบบจะแสดงภาพเริ่มต้น</small>
                        )}
                      </div>
                    </>
                  )}
                </Card>
              </div>
            );

            if (cardId === 'vip') return (
              <div
                key="vip"
                className={cardWrapperClass}
                draggable
                onDragStart={(e) => handleDragStart(e, 'vip')}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, 'vip')}
                onDrop={(e) => handleDrop(e, 'vip')}
              >
                <Card type="setting" className={`vip-card ${isCollapsed ? 'card-collapsed' : ''}`}>
                  <div className="card-drag-handle" title="กดค้างแล้วลากเพื่อย้ายตำแหน่ง">
                    <span className="drag-icon">⠿</span>
                    <span style={{ fontSize: '18px', fontWeight: 700 }}>VIP & Display Control</span>
                    <button className="card-eye-btn" onClick={(e) => { e.stopPropagation(); toggleCardVisibility('vip'); }} title={isCollapsed ? 'แสดง' : 'ซ่อน'}>
                      {isCollapsed ? '👁‍🗨' : '👁'}
                    </button>
                  </div>
                  {isCollapsed ? null : (
                    <>
                      {/* Public Broadcaster Display Control */}
                      <div className="public-broadcast-control">
                        <div className="broadcast-header">
                          <span className="broadcast-title">📺 Public Display Control</span>
                          <span className="broadcast-subtitle">ควบคุมการแสดงผลบนหน้าจอผู้ใช้</span>
                        </div>

                        <div className="broadcast-buttons">
                          <button className={`broadcast-btn ${publicRankingType === "daily" ? "active" : ""}`} onClick={() => handleSetPublicRankingType("daily")} disabled={!systemOn}>
                            {publicRankingType === "daily" && <span className="live-indicator">🔴 LIVE</span>}
                            <span>รายวัน</span>
                          </button>
                          <button className={`broadcast-btn ${publicRankingType === "monthly" ? "active" : ""}`} onClick={() => handleSetPublicRankingType("monthly")} disabled={!systemOn}>
                            {publicRankingType === "monthly" && <span className="live-indicator">🔴 LIVE</span>}
                            <span>รายเดือน</span>
                          </button>
                          <button className={`broadcast-btn ${publicRankingType === "alltime" ? "active" : ""}`} onClick={() => handleSetPublicRankingType("alltime")} disabled={!systemOn}>
                            {publicRankingType === "alltime" && <span className="live-indicator">🔴 LIVE</span>}
                            <span>ตลอดกาล</span>
                          </button>
                        </div>
                      </div>

                      <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, #e2e8f0, transparent)", margin: "20px 0" }}></div>

                      {/* Admin Ranking View filter */}
                      <div className="rank-panel-heading">
                        <div>
                          <p className="rank-panel-title">VIP Supporters (Admin View)</p>
                          <small>อันดับ 1-{rankLimit}</small>
                        </div>
                        <Button variant="secondary" onClick={() => loadTopRanks(topRanks.length > 0)} disabled={refreshingRanks} className="rank-refresh-btn" style={{ padding: '6px 12px', fontSize: '12px' }}>
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
                        <button className={`ranking-type-btn ${rankingType === "daily" ? "active" : ""}`} onClick={() => { setRankingType("daily"); setSelectedDate(getTodayStr()); }}>รายวัน</button>
                        <button className={`ranking-type-btn ${rankingType === "monthly" ? "active" : ""}`} onClick={() => { setRankingType("monthly"); setSelectedMonth(getCurrentMonthStr()); }}>รายเดือน</button>
                        <button className={`ranking-type-btn ${rankingType === "alltime" ? "active" : ""}`} onClick={() => { setRankingType("alltime"); setSelectedYear(getCurrentYearStr()); }}>ตลอดกาล</button>
                      </div>

                      <div className="rank-date-filter">
                        {rankingType === "daily" && (
                          <div className="date-picker-row">
                            <label>📅 เลือกวันที่:</label>
                            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} max={new Date().toISOString().split('T')[0]} min={`${new Date().getFullYear()}-01-01`} className="date-picker-input" />
                            {selectedDate && <button className="clear-filter-btn" onClick={() => setSelectedDate("")}>✕ ล้าง</button>}
                          </div>
                        )}
                        {rankingType === "monthly" && (
                          <div className="date-picker-row">
                            <label>📅 เลือกเดือน:</label>
                            <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} max={new Date().toISOString().slice(0, 7)} min={`${new Date().getFullYear()}-01`} className="date-picker-input" />
                            {selectedMonth && <button className="clear-filter-btn" onClick={() => setSelectedMonth("")}>✕ ล้าง</button>}
                          </div>
                        )}
                        {rankingType === "alltime" && (
                          <div className="date-picker-row">
                            <label>📅 เลือกปี:</label>
                            <Select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} options={[{ value: '', label: 'ทุกปี' }, ...Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => ({ value: String(year), label: String(year) }))]} className="date-picker-input" style={{ padding: '4px 10px', height: 'auto', border: '1px solid #cbd5e1' }} />
                            {selectedYear && <button className="clear-filter-btn" onClick={() => setSelectedYear("")}>✕ ล้าง</button>}
                          </div>
                        )}
                      </div>

                      <div className="rank-summary-box">
                        <div className="summary-item">
                          <span className="summary-label">{rankingType === "daily" ? "💰 ยอดรวมรายวัน" : rankingType === "monthly" ? "💰 ยอดรวมรายเดือน" : "💰 ยอดรวมตลอดกาล"}</span>
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
                              <div className="rank-user-info"><div className="placeholder-bar"></div><div className="placeholder-bar small"></div></div>
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

                      <button type="button" className="view-more-ranks" onClick={handleOpenAllRanks}>ดูอันดับทั้งหมด</button>

                      {/* จัดการสิทธิพิเศษ Button */}
                      <Button variant="primary" onClick={handleOpenPerksModal} className="manage-perks-btn" style={{ width: "100%", marginTop: "12px", background: "linear-gradient(135deg, #f59e0b, #d97706)", boxShadow: "0 4px 12px rgba(245, 158, 11, 0.3)" }}>
                        <span>⚙️</span><span>จัดการสิทธิพิเศษ</span>
                      </Button>

                      {/* สถิติรายรับ Button */}
                      <Button variant="primary" onClick={() => setShowIncomeStats(true)} className="manage-perks-btn income-stats-btn" style={{ width: "100%", marginTop: "12px", background: "linear-gradient(135deg, #0ea5e9, #0284c7)", boxShadow: "0 4px 12px rgba(14, 165, 233, 0.3)" }}>
                        <span>📈</span> เช็คสถิติรายรับ
                      </Button>
                    </>
                  )}
                </Card>
              </div>
            );

            return null;
          })}
        </div>
      </main>

      {/* ===== Modal: แสดงอันดับทั้งหมด ===== */}
      {showAllRanks && (
        <div className="rank-modal-overlay" onClick={handleCloseAllRanks}>
          <div className="rank-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rank-modal-header">
              <div>
                <h3>ประวัติการใช้จ่ายทั้งหมด</h3>
                <p>รวม {totalRankers} ผู้ใช้</p>
              </div>
              <button type="button" className="close-rank-modal" onClick={handleCloseAllRanks}>✕</button>
            </div>
            <div className="rank-modal-body">
              {fetchingAllRanks ? (
                <p>กำลังโหลด...</p>
              ) : allRankError ? (
                <p className="rank-error">{allRankError}</p>
              ) : modalRanks.length === 0 ? (
                <p className="rank-empty">ยังไม่มีข้อมูลอันดับ</p>
              ) : (
                <ul className="rank-modal-list">
                  {modalRanks.map((entry, idx) => {
                    const position = entry.position || idx + 1;
                    let points = entry.points || 0;
                    if (rankingType === "daily") points = entry.dailyPoints ?? entry.points ?? 0;
                    else if (rankingType === "monthly") points = entry.monthlyPoints ?? entry.points ?? 0;

                    return (
                      <li key={`${entry.name}-${position}`}>
                        <span className="rank-index">#{position}</span>
                        <div className="rank-user-info">
                          <strong>{entry.name}</strong>
                          <small>อัปเดต {formatUpdatedAt(entry.updatedAt)}</small>
                        </div>
                        <span className="rank-points">฿{formatCurrency(points)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal: แสดง QR Code สำหรับลูกค้า ===== */}
      {showQrModal && (
        <div className="rank-modal-overlay" onClick={() => setShowQrModal(false)}>
          <div className="rank-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px" }}>
            <div className="rank-modal-header">
              <div>
                <h3>📱 QR Code สำหรับลูกค้า</h3>
                <p>สแกนเพื่อเข้าสู่ระบบของร้านคุณ</p>
              </div>
              <button type="button" className="close-rank-modal" onClick={() => setShowQrModal(false)}>✕</button>
            </div>
            <div className="rank-modal-body" style={{ textAlign: "center", padding: "30px" }}>
              {qrCodeUrl ? (
                <>
                  <div style={{ background: "#fff", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 6px rgba(0,0,0,0.1)", display: "inline-block" }}>
                    <img src={qrCodeUrl} alt="QR Code" style={{ width: "300px", height: "300px", display: "block" }} />
                  </div>
                  <div className="flex flex-col" style={{ marginTop: "24px", gap: "10px" }}>
                    <a
                      href={qrCodeUrl}
                      download={`qr-code-shop-${adminId}.png`}
                      style={{ padding: "14px 24px", background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", textDecoration: "none", borderRadius: "10px", fontWeight: "600", display: "inline-block", fontSize: "15px" }}
                    >
                      💾 ดาวน์โหลด QR Code
                    </a>
                    <Button
                      onClick={() => {
                        const url = `${USER_FRONTEND_URL}/?shopId=${shopId || localStorage.getItem('shopId') || 'CMES ADMIN'}`;
                        navigator.clipboard.writeText(url);
                        showToast("✅ คัดลอกลิงก์สำเร็จ!", "success");
                      }}
                      style={{ padding: "14px 24px", background: "linear-gradient(135deg, #0ea5e9, #0284c7)" }}
                    >
                      📋 คัดลอกลิงก์ให้ลูกค้าสแกน/กดเข้า
                    </Button>
                    <Button
                      onClick={() => {
                        const url = `${USER_FRONTEND_URL}/?shopId=${shopId || localStorage.getItem('shopId') || 'CMES ADMIN'}`;
                        window.open(url, '_blank');
                      }}
                      style={{ padding: "14px 24px", background: "linear-gradient(135deg, #a855f7, #9333ea)" }}
                    >
                      🌐 ทดสอบเปิดหน้าต่างผู้ใช้งาน
                    </Button>
                  </div>

                  <div style={{ marginTop: "20px", padding: "16px", background: "linear-gradient(135deg, #f0f9ff, #e0f2fe)", borderRadius: "10px", border: "1px solid #0ea5e9" }}>
                    <small style={{ display: "block", color: "#0369a1", fontSize: "13px", fontWeight: "600", marginBottom: "8px" }}>🔗 URL ของคุณ:</small>
                    <small style={{ display: "block", color: "#64748b", fontSize: "12px", wordBreak: "break-all", fontFamily: "monospace" }}>
                      {`${USER_FRONTEND_URL}/?shopId=${shopId || 'CMES ADMIN'}`}
                    </small>
                  </div>

                  <div style={{ marginTop: "16px", padding: "12px", background: "#fef3c7", borderRadius: "8px", border: "1px solid #f59e0b" }}>
                    <small style={{ color: "#92400e", fontSize: "12px", display: "block" }}>
                      💡 <strong>คำแนะนำ:</strong> พิมพ์ QR Code นี้ติดไว้ที่โต๊ะหรือบริเวณร้าน<br />ลูกค้าสามารถสแกนเพื่อเข้าใช้งานระบบของคุณได้ทันที
                    </small>
                  </div>
                </>
              ) : (
                <p style={{ color: "#64748b" }}>กำลังสร้าง QR Code...</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal: แสดงลิงก์ OBS / แผงควบคุม ===== */}
      {showObsModal && (
        <div className="rank-modal-overlay">
          <div className="rank-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "1050px", width: "95%", maxHeight: "90vh", overflowY: "auto", background: "rgba(255, 255, 255, 0.95)", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.7)", backdropFilter: "blur(16px)", borderRadius: "24px" }}>
            <div className="rank-modal-header" style={{ marginBottom: "20px", borderBottom: "2px solid rgba(102, 126, 234, 0.1)", paddingBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h3 style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontSize: "24px", fontWeight: "800", letterSpacing: "0.5px", margin: "0 0 8px 0", display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "28px", WebkitTextFillColor: "initial" }}>🎥</span> OBS Studio Control Panel
                </h3>
                <p style={{ color: "#64748b", margin: 0, fontSize: "14px", fontWeight: "500" }}>คัดลอกลิงก์ Overlay หรือใช้แผงควบคุมสลับฉาก/คุมเสียงได้ที่นี่</p>
              </div>
              <button type="button" className="close-rank-modal" onClick={() => setShowObsModal(false)}>✕</button>
            </div>
            <div className="rank-modal-body" style={{ padding: "0 0 10px 0", display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* OBS browser sources link panel */}
              <div style={{ background: "rgba(248, 250, 252, 0.7)", padding: "20px", borderRadius: "16px", border: "1px solid rgba(102, 126, 234, 0.15)" }}>
                <h4 style={{ color: "#334155", margin: "0 0 16px 0", fontSize: "16px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>🔗</span> OBS Browser Source Links <span style={{ fontSize: "11px", color: "#667eea", background: "rgba(102, 126, 234, 0.1)", padding: "4px 10px", borderRadius: "8px", marginLeft: "auto", fontWeight: "600" }}>{adminUsername}</span>
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
                  <div className="flex flex-col" style={{ gap: "6px" }}>
                    <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748b" }}>1. Image & Text</label>
                    <div className="flex" style={{ gap: "8px" }}>
                      <input type="text" readOnly value={`${API_BASE_URL}/obs-image-overlay.html?shopId=${shopId || adminId}`} style={{ flex: 1, padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "12px", background: "#ffffff", color: "#334155", outline: "none" }} />
                      <Button
                        onClick={() => {
                          navigator.clipboard.writeText(`${API_BASE_URL}/obs-image-overlay.html?shopId=${shopId || adminId}`);
                          setCopiedImage(true);
                          setTimeout(() => setCopiedImage(false), 2000);
                        }}
                        style={{ padding: "8px 16px", background: copiedImage ? "linear-gradient(135deg, #10b981, #059669)" : "linear-gradient(135deg, #667eea, #764ba2)" }}
                      >
                        {copiedImage ? "✓" : "Copy"}
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col" style={{ gap: "6px" }}>
                    <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748b" }}>2. Ranking</label>
                    <div className="flex" style={{ gap: "8px" }}>
                      <input type="text" readOnly value={`${API_BASE_URL}/obs-ranking-overlay.html?shopId=${shopId || adminId}`} style={{ flex: 1, padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "12px", background: "#ffffff", color: "#334155", outline: "none" }} />
                      <Button
                        onClick={() => {
                          navigator.clipboard.writeText(`${API_BASE_URL}/obs-ranking-overlay.html?shopId=${shopId || adminId}`);
                          setCopiedRanking(true);
                          setTimeout(() => setCopiedRanking(false), 2000);
                        }}
                        style={{ padding: "8px 16px", background: copiedRanking ? "linear-gradient(135deg, #10b981, #059669)" : "linear-gradient(135deg, #667eea, #764ba2)" }}
                      >
                        {copiedRanking ? "✓" : "Copy"}
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col" style={{ gap: "6px" }}>
                    <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748b" }}>3. Lucky Wheel</label>
                    <div className="flex" style={{ gap: "8px" }}>
                      <input type="text" readOnly value={`${API_BASE_URL}/obs-lucky-wheel.html?shopId=${shopId || adminId}`} style={{ flex: 1, padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "12px", background: "#ffffff", color: "#334155", outline: "none" }} />
                      <Button
                        onClick={() => {
                          navigator.clipboard.writeText(`${API_BASE_URL}/obs-lucky-wheel.html?shopId=${shopId || adminId}`);
                          setCopiedWheel(true);
                          setTimeout(() => setCopiedWheel(false), 2000);
                        }}
                        style={{ padding: "8px 16px", background: copiedWheel ? "linear-gradient(135deg, #10b981, #059669)" : "linear-gradient(135deg, #667eea, #764ba2)" }}
                      >
                        {copiedWheel ? "✓" : "Copy"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lazy-loaded OBS control element inside ErrorBoundary */}
              <div style={{ marginTop: "10px", width: "100%" }}>
                <ErrorBoundary>
                  <Suspense fallback={<div className="system-off-msg-minimal" style={{ background: '#f8fafc', color: '#64748b', border: '1px dashed #cbd5e1' }}>⏳ กำลังโหลดแผงควบคุม OBS Realtime...</div>}>
                    <LazyOBSControl API_BASE_URL={API_BASE_URL} adminId={adminId} shopId={shopId || adminId} />
                  </Suspense>
                </ErrorBoundary>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal: จัดการสิทธิพิเศษสำหรับสมาชิก VIP ===== */}
      {showPerksModal && (
        <div className="rank-modal-overlay" onClick={handleClosePerksModal}>
          <div className="rank-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "650px", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            <div className="rank-modal-header">
              <div>
                <h3>⚙️ จัดการสิทธิพิเศษสำหรับสมาชิกพรีเมียม</h3>
                <p>แก้ไขสิทธิพิเศษที่จะแสดงให้กับสมาชิก Top Rank</p>
              </div>
              <button type="button" className="close-rank-modal" onClick={handleClosePerksModal}>✕</button>
            </div>

            <div className="rank-modal-body" style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ fontSize: "16px", fontWeight: "700", color: "#1e293b", marginBottom: "12px" }}>📋 รายการสิทธิพิเศษปัจจุบัน</h4>
                {perks.length === 0 ? (
                  <div style={{ padding: "24px", background: "#f8fafc", borderRadius: "12px", textAlign: "center", color: "#64748b" }}>ยังไม่มีสิทธิพิเศษ กรุณาเพิ่มสิทธิพิเศษด้านล่าง</div>
                ) : (
                  <div className="flex flex-col" style={{ gap: "12px" }}>
                    {perks.map((perk, index) => (
                      <div
                        key={index}
                        style={{
                          padding: "16px",
                          background: editingPerkIndex === index ? "#fff7ed" : "rgba(248, 250, 252, 0.7)",
                          borderRadius: "12px",
                          border: editingPerkIndex === index ? "2px solid #f97316" : "1px solid rgba(102, 126, 234, 0.15)",
                          display: "flex",
                          alignItems: "center",
                          gap: "16px",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
                        }}
                      >
                        {editingPerkIndex === index ? (
                          <div className="flex flex-col" style={{ gap: "12px", width: "100%" }}>
                            <input
                              type="text"
                              value={perkInputValue}
                              onChange={(e) => setPerkInputValue(e.target.value)}
                              style={{ width: "100%", padding: "12px 16px", border: "2px solid #f97316", borderRadius: "10px", fontSize: "14px", outline: "none", boxShadow: "0 0 0 3px rgba(249, 115, 22, 0.1)", boxSizing: "border-box" }}
                              placeholder="แก้ไขข้อความสิทธิพิเศษ"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSavePerk();
                                if (e.key === 'Escape') handleCancelEditPerk();
                              }}
                            />
                            <div className="flex" style={{ justifyContent: "flex-end", gap: "8px" }}>
                              <Button variant="secondary" onClick={handleCancelEditPerk} style={{ padding: "8px 16px" }}>ยกเลิก</Button>
                              <Button onClick={handleSavePerk} style={{ padding: "8px 16px", background: "#10b981", boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)" }}>บันทึก</Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div style={{ flex: 1, fontSize: "15px", color: "#334155", fontWeight: "500", lineHeight: "1.5" }}>{perk}</div>
                            <div className="flex" style={{ gap: "8px" }}>
                              <Button variant="edit" onClick={() => handleEditPerk(index)}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                <span>แก้ไข</span>
                              </Button>
                              <Button variant="danger" onClick={() => handleDeletePerk(index)}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                <span>ลบ</span>
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add New Perk */}
              <div style={{ marginTop: "24px", padding: "20px", background: "rgba(102, 126, 234, 0.05)", borderRadius: "16px", border: "1px dashed rgba(102, 126, 234, 0.4)" }}>
                <h4 style={{ fontSize: "16px", fontWeight: "700", color: "#334155", marginBottom: "12px" }}>➕ เพิ่มสิทธิพิเศษใหม่</h4>
                <div className="flex flex-col" style={{ gap: "12px" }}>
                  <input
                    type="text"
                    value={editingPerkIndex === null ? perkInputValue : ""}
                    onChange={(e) => setPerkInputValue(e.target.value)}
                    disabled={editingPerkIndex !== null}
                    placeholder="เช่น: 🎁 ลดราคาพิเศษ 10% สำหรับสมาชิก VIP"
                    style={{ width: "100%", padding: "14px 16px", border: "1px solid rgba(102, 126, 234, 0.3)", borderRadius: "12px", fontSize: "14px", outline: "none", opacity: editingPerkIndex !== null ? 0.5 : 1, boxSizing: "border-box" }}
                    onKeyPress={(e) => { if (e.key === "Enter" && editingPerkIndex === null) handleAddPerk(); }}
                  />
                  <div className="flex" style={{ justifyContent: "flex-end" }}>
                    <Button onClick={handleAddPerk} disabled={editingPerkIndex !== null}>➕ เพิ่มสิทธิพิเศษ</Button>
                  </div>
                </div>
                <small style={{ display: "block", marginTop: "12px", color: "#64748b", fontSize: "12px" }}>💡 เคล็ดลับ: เริ่มต้นด้วย emoji เพื่อให้ดูน่าสนใจมากขึ้น เช่น 🎁 🌟 💎 📱</small>
              </div>

              {/* Save Perks Buttons */}
              <div className="flex" style={{ marginTop: "24px", gap: "12px" }}>
                <Button variant="secondary" onClick={handleClosePerksModal} disabled={savingPerks} style={{ width: "120px", padding: "16px 24px" }}>
                  ปิด
                </Button>
                <Button onClick={handleSaveAllPerks} disabled={savingPerks || perks.length === 0} style={{ flex: 1, padding: "16px 24px" }}>
                  {savingPerks ? "กำลังบันทึก..." : "💾 บันทึกทั้งหมด"}
                </Button>
              </div>

              <div style={{ marginTop: "20px", padding: "16px", background: "rgba(241, 245, 249, 0.7)", borderRadius: "12px", border: "1px solid rgba(226, 232, 240, 0.8)" }}>
                <small style={{ color: "#475569", fontSize: "13px", display: "block", lineHeight: "1.6" }}>
                  <strong>📌 หมายเหตุ:</strong> สิทธิพิเศษเหล่านี้จะแสดงบนหน้าแรกของผู้ใช้<br />เพื่อดึงดูดให้สมาชิกเข้าร่วมการแข่งขัน Top Rank มากขึ้น
                </small>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Lazy load Modal: Income Stats Analyzer inside ErrorBoundary ===== */}
      {showIncomeStats && (
        <ErrorBoundary>
          <Suspense fallback={<div className="system-off-msg-minimal" style={{ margin: '20px', background: '#f8fafc', color: '#64748b' }}>⏳ กำลังโหลดสถิติรายรับ...</div>}>
            <LazyIncomeStats show={showIncomeStats} onClose={() => setShowIncomeStats(false)} />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* ===== Lazy load Toast Notifications ===== */}
      {toastConfig.message && (
        <ErrorBoundary>
          <Suspense fallback={null}>
            <LazyToast message={toastConfig.message} type={toastConfig.type} onClose={() => setToastConfig({ message: "", type: "success" })} />
          </Suspense>
        </ErrorBoundary>
      )}
    </div>
  );
}

export default Home;
