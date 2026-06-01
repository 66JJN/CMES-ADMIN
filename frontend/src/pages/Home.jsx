import React, { useContext, useEffect } from 'react';
import { ShopContext } from '../contexts/ShopContext';
import { HomeProvider, HomeContext } from '../contexts/HomeContext';
import useDashboardData from '../hooks/useDashboardData';
import FeatureSwitches from '../components/dashboard/FeatureSwitches';
import PackageConfig from '../components/dashboard/PackageConfig';
import VipSupporters from '../components/dashboard/VipSupporters';
import DashboardModals from '../components/dashboard/DashboardModals';
import { API_BASE_URL, USER_FRONTEND_URL } from '../config/apiConfig';
import { useNavigate } from 'react-router-dom';
import '../01_Home/home.css';
import '../components/dashboard/AdminHeader.css';
import '../components/dashboard/DashboardShared.css';
import '../components/dashboard/DashboardCards.css';

/**
 * Main Home page wrapper initializing local HomeProvider context contextually.
 */
export default function Home() {
  const { socket, shopId } = useContext(ShopContext);

  return (
    <HomeProvider socket={socket} shopId={shopId}>
      <HomeContent />
    </HomeProvider>
  );
}

/**
 * High-level layout composer for CMES-ADMIN Dashboard.
 * Strictly separates display layout from modal details, hooks, and submodules.
 */
function HomeContent() {
  const navigate = useNavigate();
  const {
    shopId,
    shopProfile,
    rankingType,
    rankLimit,
    selectedDate,
    selectedMonth,
    selectedYear,
    showAllRanks,
    setQrCodeUrl,
    setShowQrModal,
    setShowObsModal
  } = useContext(HomeContext);

  const {
    cardOrder,
    cardVisibility,
    draggedCard,
    dragOverCard,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    toggleCardVisibility,
    loadShopProfile,
    loadPerks,
    loadTopRanks,
    loadRankingSummary,
    loadAllRanks,
    loadBirthdayRequirement
  } = useDashboardData();

  // Restore auto-fetch removed during refactor (perks, ranks, birthday config)
  useEffect(() => {
    loadShopProfile();
    loadPerks();
    loadBirthdayRequirement();
  }, [loadShopProfile, loadPerks, loadBirthdayRequirement]);

  useEffect(() => {
    loadTopRanks();
    loadRankingSummary();
  }, [
    rankingType,
    rankLimit,
    selectedDate,
    selectedMonth,
    selectedYear,
    loadTopRanks,
    loadRankingSummary,
  ]);

  useEffect(() => {
    if (showAllRanks) {
      loadAllRanks();
    }
  }, [
    showAllRanks,
    rankingType,
    selectedDate,
    selectedMonth,
    selectedYear,
    loadAllRanks,
  ]);

  const adminUsername = localStorage.getItem("adminUsername") || "Admin";

  const generateQRCode = () => {
    const shopParam = shopId || localStorage.getItem('shopId') || 'CMES ADMIN';
    const userAppUrl = `${USER_FRONTEND_URL}/?shopId=${shopParam}`;
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(userAppUrl)}&format=png&ecc=H`;
    setQrCodeUrl(qrApiUrl);
    setShowQrModal(true);
  };

  return (
    <div className="admin-home-minimal">
      {/* ===== Header Navigation Panel ===== */}
      <header className="admin-header-minimal">
        <div className="admin-header-inner">
          <div className="brand-minimal" title={shopId || "CMES ADMIN"}>
            <div className={`brand-title-content ${(shopId || "CMES ADMIN").length > 15 ? 'marquee' : ''}`}>
              <span className="brand-title">{shopId || "CMES ADMIN"}</span>
              {(shopId || "CMES ADMIN").length > 15 && <span className="brand-title">{shopId || "CMES ADMIN"}</span>}
            </div>
          </div>
          <nav className="nav-minimal" aria-label="เมนูหลัก">
            <a href="/TimeHistory">ประวัติการตั้งเวลา</a>
            <a href="/image-queue">ตรวจสอบรูปภาพ</a>
            <a href="/report">รายงาน</a>
            <a href="/check-history">ประวัติการตรวจสอบ</a>
            <a href="/lucky-wheel">วงล้อเสี่ยงดวง</a>
            <a href="/gift-setting">ตั้งค่าส่งของขวัญ</a>
            <a href="#!" onClick={(e) => { e.preventDefault(); setShowObsModal(true); }}>OBS Links</a>
            <a
              href="#!"
              onClick={(e) => { e.preventDefault(); generateQRCode(); }}
              title="QR Code ร้านค้า"
            >
              ลิงก์ & QR Code
            </a>
          </nav>
          <div className="header-avatar-group">
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
        </div>
      </header>

      {/* ===== Main Dashboard Layout Area ===== */}
      <main className="admin-main-minimal">
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
                <FeatureSwitches
                  isCollapsed={isCollapsed}
                  onToggleVisibility={() => toggleCardVisibility('feature')}
                />
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
                <PackageConfig
                  isCollapsed={isCollapsed}
                  onToggleVisibility={() => toggleCardVisibility('package')}
                />
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
                <VipSupporters
                  isCollapsed={isCollapsed}
                  onToggleVisibility={() => toggleCardVisibility('vip')}
                />
              </div>
            );

            return null;
          })}
        </div>
      </main>

      {/* ===== Dialogs & Modals Overlays ===== */}
      <DashboardModals />
    </div>
  );
}
