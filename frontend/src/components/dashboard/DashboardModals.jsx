import React, { useState, useContext, useEffect, Suspense, lazy } from 'react';
import { HomeContext } from '../../contexts/HomeContext';
import { ShopContext } from '../../contexts/ShopContext';
import { API_BASE_URL, USER_FRONTEND_URL } from '../../config/apiConfig';
import adminFetch from '../../config/authFetch';
import Button from '../ui/Button';
import ErrorBoundary from '../ui/ErrorBoundary';
import './DashboardShared.css';
import './DashboardModals.css';

// Lazy-loaded heavy modules
const LazyIncomeStats = lazy(() => import('./IncomeStats'));
const LazyOBSControl = lazy(() => import('../../pages/OBSControlPage'));
const LazyToast = lazy(() => import('../ui/Toast'));

const formatCurrency = (value) => Number(value || 0).toLocaleString("th-TH");

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
 * DashboardModals layout component.
 * Houses dialog overlays (All Ranks, Merchant QR Code, OBS Controller Panel, Perks Setup, Income Stats).
 * This completely isolates popup mechanics, keeping Home.jsx extremely lightweight.
 */
export default function DashboardModals() {
  const { socket, shopId } = useContext(ShopContext);
  const {
    rankingType,
    totalRankers,
    allRanks,
    fetchingAllRanks,
    allRankError,
    showIncomeStats, setShowIncomeStats,
    showQrModal, setShowQrModal,
    showObsModal, setShowObsModal,
    showPerksModal, setShowPerksModal,
    showAllRanks, setShowAllRanks,
    perks, setPerks,
    editingPerkIndex, setEditingPerkIndex,
    perkInputValue, setPerkInputValue,
    savingPerks, setSavingPerks,
    qrCodeUrl,
    toastConfig, setToastConfig, showToast
  } = useContext(HomeContext);

  const adminId = localStorage.getItem("adminId") || "default-admin";
  const adminUsername = localStorage.getItem("adminUsername") || "Admin";

  const [copiedImage, setCopiedImage] = useState(false);
  const [copiedRanking, setCopiedRanking] = useState(false);
  const [copiedWheel, setCopiedWheel] = useState(false);

  // Reload perks when opening modal (ensures list matches DB / user-facing data)
  useEffect(() => {
    if (!showPerksModal) return;
    const fetchPerks = async () => {
      try {
        const res = await adminFetch(`${API_BASE_URL}/api/config/perks`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && Array.isArray(data.perks)) {
          setPerks(data.perks);
        }
      } catch (error) {
        console.error('[DashboardModals] loadPerks failed', error);
      }
    };
    fetchPerks();
  }, [showPerksModal, setPerks]);

  // Perks handlers
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

  return (
    <>
      {/* ===== Modal: แสดงอันดับทั้งหมด ===== */}
      {showAllRanks && (
        <div className="rank-modal-overlay" onClick={() => setShowAllRanks(false)}>
          <div className="rank-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rank-modal-header">
              <div>
                <h3>ประวัติการใช้จ่ายทั้งหมด</h3>
                <p>รวม {totalRankers} ผู้ใช้</p>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setShowAllRanks(false)} aria-label="ปิดหน้าต่าง">✕</button>
            </div>
            <div className="rank-modal-body">
              {fetchingAllRanks ? (
                <p>กำลังโหลด...</p>
              ) : allRankError ? (
                <p className="rank-error">{allRankError}</p>
              ) : allRanks.length === 0 ? (
                <p className="rank-empty">ยังไม่มีข้อมูลอันดับ</p>
              ) : (
                <ul className="rank-modal-list">
                  {allRanks.map((entry, idx) => {
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
          <div className="rank-modal qr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rank-modal-header">
              <div>
                <h3>📱 QR Code สำหรับลูกค้า</h3>
                <p>สแกนเพื่อเข้าสู่ระบบของร้านคุณ</p>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setShowQrModal(false)} aria-label="ปิดหน้าต่าง">✕</button>
            </div>
            <div className="rank-modal-body qr-modal-body">
              {qrCodeUrl ? (
                <>
                  <div className="qr-image-wrapper">
                    <img src={qrCodeUrl} alt="QR Code" />
                  </div>
                  <div className="qr-actions-column">
                    <a
                      href={qrCodeUrl}
                      download={`qr-code-shop-${adminId}.png`}
                      className="btn-download-qr"
                    >
                      💾 ดาวน์โหลด QR Code
                    </a>
                    <Button
                      onClick={() => {
                        const url = `${USER_FRONTEND_URL}/?shopId=${shopId || localStorage.getItem('shopId') || 'CMES ADMIN'}`;
                        navigator.clipboard.writeText(url);
                        showToast("✅ คัดลอกลิงก์สำเร็จ!", "success");
                      }}
                      className="btn-copy-url"
                    >
                      📋 คัดลอกลิงก์ให้ลูกค้าสแกน/กดเข้า
                    </Button>
                    <Button
                      onClick={() => {
                        const url = `${USER_FRONTEND_URL}/?shopId=${shopId || localStorage.getItem('shopId') || 'CMES ADMIN'}`;
                        window.open(url, '_blank');
                      }}
                      className="btn-test-user"
                    >
                      🌐 ทดสอบเปิดหน้าต่างผู้ใช้งาน
                    </Button>
                  </div>

                  <div className="qr-link-box">
                    <small className="qr-link-label">🔗 URL ของคุณ:</small>
                    <small className="qr-link-url">
                      {`${USER_FRONTEND_URL}/?shopId=${shopId || 'CMES ADMIN'}`}
                    </small>
                  </div>

                  <div className="qr-instruction-alert">
                    <small>
                      💡 <strong>คำแนะนำ:</strong> พิมพ์ QR Code นี้ติดไว้ที่โต๊ะหรือบริเวณร้าน<br />ลูกค้าสามารถสแกนเพื่อเข้าใช้งานระบบของคุณได้ทันที
                    </small>
                  </div>
                </>
              ) : (
                <p className="qr-loading-text">กำลังสร้าง QR Code...</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal: แสดงลิงก์ OBS / แผงควบคุม ===== */}
      {showObsModal && (
        <div className="rank-modal-overlay" onClick={() => setShowObsModal(false)}>
          <div className="rank-modal obs-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rank-modal-header obs-modal-header">
              <div>
                <h3 className="obs-modal-title">
                  <span>🎥</span> OBS Studio Control Panel
                </h3>
                <p className="obs-modal-subtitle">คัดลอกลิงก์ Overlay หรือใช้แผงควบคุมสลับฉาก/คุมเสียงได้ที่นี่</p>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setShowObsModal(false)} aria-label="ปิดหน้าต่าง">✕</button>
            </div>
            <div className="rank-modal-body obs-modal-body">
              <div className="obs-links-section">
                <h4 className="obs-section-title">
                  <span>🔗</span> OBS Browser Source Links 
                  <span className="obs-admin-badge">{adminUsername}</span>
                </h4>
                <div className="obs-grid-inputs">
                  <div className="obs-input-group">
                    <label>1. Image & Text</label>
                    <div className="obs-copy-row">
                      <input type="text" readOnly value={`${API_BASE_URL}/obs-image-overlay.html?shopId=${shopId || adminId}`} />
                      <Button
                        onClick={() => {
                          navigator.clipboard.writeText(`${API_BASE_URL}/obs-image-overlay.html?shopId=${shopId || adminId}`);
                          setCopiedImage(true);
                          setTimeout(() => setCopiedImage(false), 2000);
                        }}
                        className={copiedImage ? "btn-copied" : "btn-copy"}
                      >
                        {copiedImage ? "✓" : "Copy"}
                      </Button>
                    </div>
                  </div>

                  <div className="obs-input-group">
                    <label>2. Ranking</label>
                    <div className="obs-copy-row">
                      <input type="text" readOnly value={`${API_BASE_URL}/obs-ranking-overlay.html?shopId=${shopId || adminId}`} />
                      <Button
                        onClick={() => {
                          navigator.clipboard.writeText(`${API_BASE_URL}/obs-ranking-overlay.html?shopId=${shopId || adminId}`);
                          setCopiedRanking(true);
                          setTimeout(() => setCopiedRanking(false), 2000);
                        }}
                        className={copiedRanking ? "btn-copied" : "btn-copy"}
                      >
                        {copiedRanking ? "✓" : "Copy"}
                      </Button>
                    </div>
                  </div>

                  <div className="obs-input-group">
                    <label>3. Lucky Wheel</label>
                    <div className="obs-copy-row">
                      <input type="text" readOnly value={`${API_BASE_URL}/obs-lucky-wheel.html?shopId=${shopId || adminId}`} />
                      <Button
                        onClick={() => {
                          navigator.clipboard.writeText(`${API_BASE_URL}/obs-lucky-wheel.html?shopId=${shopId || adminId}`);
                          setCopiedWheel(true);
                          setTimeout(() => setCopiedWheel(false), 2000);
                        }}
                        className={copiedWheel ? "btn-copied" : "btn-copy"}
                      >
                        {copiedWheel ? "✓" : "Copy"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="obs-lazy-panel-container">
                <ErrorBoundary>
                  <Suspense fallback={<div className="obs-loading-fallback">⏳ กำลังโหลดแผงควบคุม OBS Realtime...</div>}>
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
          <div className="rank-modal perks-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rank-modal-header">
              <div>
                <h3>⚙️ จัดการสิทธิพิเศษสำหรับสมาชิกพรีเมียม</h3>
                <p>แก้ไขสิทธิพิเศษที่จะแสดงให้กับสมาชิก Top Rank</p>
              </div>
              <button type="button" className="modal-close-btn" onClick={handleClosePerksModal} aria-label="ปิดหน้าต่าง">✕</button>
            </div>

            <div className="rank-modal-body perks-modal-body">
              <div className="perks-list-wrapper">
                <h4 className="perks-list-title">📋 รายการสิทธิพิเศษปัจจุบัน</h4>
                {perks.length === 0 ? (
                  <div className="perks-empty-state">ยังไม่มีสิทธิพิเศษ กรุณาเพิ่มสิทธิพิเศษด้านล่าง</div>
                ) : (
                  <div className="perks-items-column">
                    {perks.map((perk, index) => (
                      <div
                        key={index}
                        className={`perk-item-card ${editingPerkIndex === index ? "editing" : ""}`}
                      >
                        {editingPerkIndex === index ? (
                          <div className="perk-edit-inner">
                            <input
                              type="text"
                              value={perkInputValue}
                              onChange={(e) => setPerkInputValue(e.target.value)}
                              className="input-minimal perk-edit-input"
                              placeholder="แก้ไขข้อความสิทธิพิเศษ"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSavePerk();
                                if (e.key === 'Escape') handleCancelEditPerk();
                              }}
                            />
                            <div className="perk-edit-actions">
                              <Button variant="secondary" onClick={handleCancelEditPerk} className="btn-perk-cancel">ยกเลิก</Button>
                              <Button onClick={handleSavePerk} className="btn-perk-save">บันทึก</Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="perk-display-text">{perk}</div>
                            <div className="perk-actions">
                              <Button variant="edit" onClick={() => handleEditPerk(index)} className="btn-perk-edit">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                <span>แก้ไข</span>
                              </Button>
                              <Button variant="danger" onClick={() => handleDeletePerk(index)} className="btn-perk-delete">
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
              <div className="perk-add-section">
                <h4 className="perk-add-title">➕ เพิ่มสิทธิพิเศษใหม่</h4>
                <div className="perk-add-row">
                  <input
                    type="text"
                    value={editingPerkIndex === null ? perkInputValue : ""}
                    onChange={(e) => setPerkInputValue(e.target.value)}
                    disabled={editingPerkIndex !== null}
                    placeholder="เช่น: 🎁 ลดราคาพิเศษ 10% สำหรับสมาชิก VIP"
                    className="input-minimal perk-add-input"
                    onKeyPress={(e) => { if (e.key === "Enter" && editingPerkIndex === null) handleAddPerk(); }}
                  />
                  <div className="perk-add-btn-wrapper">
                    <Button onClick={handleAddPerk} disabled={editingPerkIndex !== null} className="btn-perk-add">
                      ➕ เพิ่มสิทธิพิเศษ
                    </Button>
                  </div>
                </div>
                <small className="perk-add-hint">💡 เคล็ดลับ: เริ่มต้นด้วย emoji เพื่อให้ดูน่าสนใจมากขึ้น เช่น 🎁 🌟 💎 📱</small>
              </div>

              {/* Save Perks Buttons */}
              <div className="perk-save-all-row">
                <Button variant="secondary" onClick={handleClosePerksModal} disabled={savingPerks} className="btn-perk-close">
                  ปิด
                </Button>
                <Button onClick={handleSaveAllPerks} disabled={savingPerks || perks.length === 0} className="btn-perk-save-all">
                  {savingPerks ? "กำลังบันทึก..." : "💾 บันทึกทั้งหมด"}
                </Button>
              </div>

              <div className="perks-note-box">
                <small className="perks-note-text">
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
          <Suspense fallback={<div className="income-stats-loading-fallback">⏳ กำลังโหลดสถิติรายรับ...</div>}>
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
    </>
  );
}
