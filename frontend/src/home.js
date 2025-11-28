import React, { useState, useEffect, useCallback } from "react";
import { io } from "socket.io-client";
import "./home.css";

const socket = io("http://localhost:4005");
const API_BASE_URL = (() => {
  const envUrl = (process.env.REACT_APP_ADMIN_API_BASE || "").trim();
  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    const origin = window.location.origin.replace(/\/$/, "");
    if (!origin.includes("localhost")) {
      return origin;
    }
  }
  return "http://localhost:5001";
})();
const RANK_LIMIT = 10;

const formatCurrency = (value) => Number(value || 0).toLocaleString("th-TH");
const formatUpdatedAt = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString("th-TH", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

function Home() {
  const [systemOn, setSystemOn] = useState(true);
  const [enableImage, setEnableImage] = useState(true);
  const [enableText, setEnableText] = useState(true);
  const [enableGift, setEnableGift] = useState(true);
  const [enableBirthday, setEnableBirthday] = useState(true);
  const [mode, setMode] = useState("image");
  const [minute, setMinute] = useState("");
  const [second, setSecond] = useState("");
  const [price, setPrice] = useState("");
  const [topRanks, setTopRanks] = useState([]);
  const [totalRankers, setTotalRankers] = useState(0);
  const [rankLoading, setRankLoading] = useState(true);
  const [refreshingRanks, setRefreshingRanks] = useState(false);
  const [rankError, setRankError] = useState("");
  const [showAllRanks, setShowAllRanks] = useState(false);
  const [allRanks, setAllRanks] = useState([]);
  const [allRanksLoaded, setAllRanksLoaded] = useState(false);
  const [fetchingAllRanks, setFetchingAllRanks] = useState(false);
  const [allRankError, setAllRankError] = useState("");

  useEffect(() => {
    socket.on("status", (config) => {
      setSystemOn(config.systemOn);
      setEnableImage(config.enableImage);
      setEnableText(config.enableText);
      setEnableGift(config.enableGift ?? true);
      setEnableBirthday(config.enableBirthday ?? true);
    });
    socket.emit("getConfig");
    return () => socket.off("status");
  }, []);

  const loadTopRanks = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshingRanks(true);
    } else {
      setRankLoading(true);
    }
    try {
      setRankError("");
      const res = await fetch(`${API_BASE_URL}/api/rankings?limit=${RANK_LIMIT}`);
      if (!res.ok) {
        throw new Error("FAILED");
      }
      const data = await res.json();
      if (!data.success) {
        throw new Error("FAILED");
      }
      setTopRanks(data.ranks || []);
      setTotalRankers(data.total ?? data.totalUsers ?? (data.ranks?.length || 0));
    } catch (error) {
      console.error("[Admin] โหลดข้อมูลอันดับไม่สำเร็จ", error);
      setRankError("ไม่สามารถโหลดข้อมูลอันดับได้");
      if (!silent) {
        setTopRanks([]);
      }
    } finally {
      if (silent) {
        setRefreshingRanks(false);
      } else {
        setRankLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadTopRanks();
  }, [loadTopRanks]);

  // เมื่อกดปุ่มเปิด/ปิดระบบ
  const handleToggleSystem = () => {
    const newStatus = !systemOn;
    setSystemOn(newStatus);
    // ถ้าปิดระบบ ให้ปิดทุกฟังก์ชันด้วย
    if (!newStatus) {
      setEnableImage(false);
      setEnableText(false);
      setEnableGift(false);
      setEnableBirthday(false);
      socket.emit("adminUpdateConfig", {
        systemOn: newStatus,
        enableImage: false,
        enableText: false,
        enableGift: false,
        enableBirthday: false,
      });
    } else {
      // ถ้าเปิดระบบใหม่ ให้เปิดทุกฟังก์ชัน
      setEnableImage(true);
      setEnableText(true);
      setEnableGift(true);
      setEnableBirthday(true);
      socket.emit("adminUpdateConfig", {
        systemOn: newStatus,
        enableImage: true,
        enableText: true,
        enableGift: true,
        enableBirthday: true,
      });
    }
  };

  // เปิด/ปิดฟังก์ชันส่งรูป
  const handleToggleImage = () => {
    const newStatus = !enableImage;
    setEnableImage(newStatus);
    socket.emit("adminUpdateConfig", {
      enableImage: newStatus,
      systemOn,
      enableText,
      enableGift,
      enableBirthday,
    });
  };

  // เปิด/ปิดฟังก์ชันข้อความ
  const handleToggleText = () => {
    const newStatus = !enableText;
    setEnableText(newStatus);
    socket.emit("adminUpdateConfig", {
      enableText: newStatus,
      systemOn,
      enableImage,
      enableGift,
      enableBirthday,
    });
  };

  const handleToggleGift = () => {
    const newStatus = !enableGift;
    setEnableGift(newStatus);
    socket.emit("adminUpdateConfig", {
      enableGift: newStatus,
      systemOn,
      enableImage,
      enableText,
      enableBirthday,
    });
  };

  // เปิด/ปิดฟังก์ชันอวยพรวันเกิด
  const handleToggleBirthday = () => {
    const newStatus = !enableBirthday;
    setEnableBirthday(newStatus);
    socket.emit("adminUpdateConfig", {
      enableBirthday: newStatus,
      systemOn,
      enableImage,
      enableText,
      enableGift,
    });
  };

  const handleSave = () => {
    if (!minute && !second) {
      alert("กรุณากรอกเวลาอย่างน้อย 1 ช่อง");
      return;
    }
    if (!price && mode !== "birthday") {
      alert("กรุณากรอกราคา");
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
    socket.emit("addSetting", packageData);
    setMinute("");
    setSecond("");
    setPrice("");
    alert("บันทึกแพ็คเกจสำเร็จ");
  };

  const handleOpenAllRanks = async () => {
    setShowAllRanks(true);
    if (allRanksLoaded || fetchingAllRanks) {
      return;
    }
    setFetchingAllRanks(true);
    setAllRankError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/rankings?limit=500`);
      if (!res.ok) {
        throw new Error("FAILED");
      }
      const data = await res.json();
      if (!data.success) {
        throw new Error("FAILED");
      }
      setAllRanks(data.ranks || []);
      setAllRanksLoaded(true);
      setTotalRankers(data.total ?? totalRankers);
    } catch (error) {
      console.error("[Admin] โหลดอันดับทั้งหมดไม่สำเร็จ", error);
      setAllRankError("ไม่สามารถโหลดอันดับทั้งหมดได้");
    } finally {
      setFetchingAllRanks(false);
    }
  };

  const handleCloseAllRanks = () => setShowAllRanks(false);
  const modalRanks = allRanks.length ? allRanks : topRanks;

  return (
    <div className="admin-home-minimal">
      <header className="admin-header-minimal">
        <div className="brand-minimal">
          <span className="brand-title">CMS ADMIN</span>
        </div>
        <nav className="nav-minimal">
          <a href="/TimeHistory">ประวัติการตั้งเวลา</a>
          <a href="/image-queue">ตรวจสอบรูปภาพ</a>
          <a href="/report">รายงาน</a>
          <a href="/check-history">ประวัติการตรวจสอบ</a>
          <a href="/lucky-wheel">วงล้อเสี่ยงดวง</a>
          <a href="/gift-setting">ตั้งค่าส่งของขวัญ</a>
        </nav>
      </header>

      <main className="admin-main-minimal">
        <div className="admin-dashboard-grid">
          <section className="admin-control-column">
            <div className="system-status-row">
              <span className="system-label">สถานะระบบ:</span>
              <div
                className={`switch-minimal ${systemOn ? "on" : "off"}`}
                onClick={handleToggleSystem}
                title={systemOn ? "ปิดระบบ" : "เปิดระบบ"}
              >
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

            <div className="function-toggle-row">
              <div className="toggle-card">
                <span>ฟังก์ชันส่งรูปภาพ</span>
                <button
                  className={`toggle-btn-minimal${enableImage ? " on" : " off"}`}
                  onClick={handleToggleImage}
                  disabled={!systemOn}
                >
                  {enableImage ? "เปิด" : "ปิด"}
                </button>
              </div>
              <div className="toggle-card">
                <span>ฟังก์ชันข้อความ</span>
                <button
                  className={`toggle-btn-minimal${enableText ? " on" : " off"}`}
                  onClick={handleToggleText}
                  disabled={!systemOn}
                >
                  {enableText ? "เปิด" : "ปิด"}
                </button>
              </div>
              <div className="toggle-card">
                <span>ฟังก์ชันส่งของขวัญ</span>
                <button
                  className={`toggle-btn-minimal${enableGift ? " on" : " off"}`}
                  onClick={handleToggleGift}
                  disabled={!systemOn}
                >
                  {enableGift ? "เปิด" : "ปิด"}
                </button>
              </div>
              <div className="toggle-card">
                <span>ฟังก์ชันอวยพรวันเกิด</span>
                <button
                  className={`toggle-btn-minimal${enableBirthday ? " on" : " off"}`}
                  onClick={handleToggleBirthday}
                  disabled={!systemOn}
                >
                  {enableBirthday ? "เปิด" : "ปิด"}
                </button>
              </div>
            </div>

            <section className="setting-card-minimal">
              <h2>ตั้งค่าแพ็คเกจ</h2>
              <div className="mode-select-row">
                <button
                  className={`mode-btn-minimal${mode === "image" ? " active" : ""}`}
                  onClick={() => setMode("image")}
                  disabled={!systemOn}
                >
                  รูปภาพ
                </button>
                <button
                  className={`mode-btn-minimal${mode === "text" ? " active" : ""}`}
                  onClick={() => setMode("text")}
                  disabled={!systemOn}
                >
                  ข้อความ
                </button>
                <button
                  className={`mode-btn-minimal${mode === "birthday" ? " active" : ""}`}
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
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  disabled={!systemOn}
                  className="input-minimal"
                />
              </div>

              <button
                className="save-btn-minimal"
                onClick={handleSave}
                disabled={!systemOn}
              >
                บันทึกแพ็คเกจ
              </button>
            </section>
          </section>

          <aside className="admin-rank-panel">
            <div className="rank-panel-heading">
              <div>
                <p className="rank-panel-title">VIP Supporters</p>
                <small>อันดับ 1-10 • รวม {totalRankers} คน</small>
              </div>
              <button
                type="button"
                className="rank-refresh-btn"
                onClick={() => loadTopRanks(topRanks.length > 0)}
                disabled={refreshingRanks}
              >
                {refreshingRanks ? "รีเฟรช..." : "รีเฟรช"}
              </button>
            </div>
            <ul className="rank-list">
              {rankLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <li className="rank-list-item skeleton" key={`rank-skeleton-${index}`}>
                    <div className="rank-index">--</div>
                    <div className="rank-user-info">
                      <div className="placeholder-bar"></div>
                      <div className="placeholder-bar small"></div>
                    </div>
                    <div className="rank-points">--</div>
                  </li>
                ))
              ) : topRanks.length === 0 ? (
                <li className="rank-empty">ยังไม่มีข้อมูลอันดับ</li>
              ) : (
                topRanks.map((entry, index) => (
                  <li
                    className={`rank-list-item tier-${(entry.position || index + 1) <= 3 ? entry.position || index + 1 : "default"}`}
                    key={`${entry.name}-${entry.position || index}`}
                  >
                    <div className="rank-index">#{entry.position || index + 1}</div>
                    <div className="rank-user-info">
                      <strong>{entry.name}</strong>
                      <span>อัปเดต {formatUpdatedAt(entry.updatedAt)}</span>
                    </div>
                    <div className="rank-points">฿{formatCurrency(entry.points)}</div>
                  </li>
                ))
              )}
            </ul>
            {rankError && <div className="rank-error">{rankError}</div>}
            <button type="button" className="view-more-ranks" onClick={handleOpenAllRanks}>
              ดูอันดับทั้งหมด
            </button>
          </aside>
        </div>
      </main>

      {showAllRanks && (
        <div className="rank-modal-overlay" onClick={handleCloseAllRanks}>
          <div className="rank-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rank-modal-header">
              <div>
                <h3>ประวัติการใช้จ่ายทั้งหมด</h3>
                <p>รวม {totalRankers} ผู้ใช้</p>
              </div>
              <button type="button" className="close-rank-modal" onClick={handleCloseAllRanks}>
                ✕
              </button>
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
                    return (
                      <li key={`${entry.name}-${position}`}>
                        <span className="rank-index">#{position}</span>
                        <div className="rank-user-info">
                          <strong>{entry.name}</strong>
                          <small>อัปเดต {formatUpdatedAt(entry.updatedAt)}</small>
                        </div>
                        <span className="rank-points">฿{formatCurrency(entry.points)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;