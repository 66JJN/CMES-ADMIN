import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";
import "./home.css";

const socket = io("http://localhost:4005");

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

        <div className="main-content-row">

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
            <input type="number" min="1" max="59" placeholder="นาที" value={minute}
              onChange={(e) => setMinute(e.target.value)}
              disabled={!systemOn}
              className="input-minimal"
            />
            <input type="number" min="1" max="59" placeholder="วินาที" value={second}
              onChange={(e) => setSecond(e.target.value)}
              disabled={!systemOn}
              className="input-minimal"
            />
            <input type="number" min="1" placeholder="ราคา (บาท)" value={price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={!systemOn}
              className="input-minimal"
            />
          </div>

          <button className="save-btn-minimal" onClick={handleSave} disabled={!systemOn}>
            บันทึกแพ็คเกจ
          </button>
        </section>

        <section className="functions-panel">
          <h3>ตั้งค่าฟังก์ชัน</h3>
          <div className="function-toggle-group">
            <div className="function-item">
              <span>ฟังก์ชันส่งรูปภาพ:</span>
              <button className={`toggle-btn-minimal${enableImage ? " on" : " off"}`}
                onClick={handleToggleImage}
                disabled={!systemOn}>
                {enableImage ? "เปิด" : "ปิด"}
              </button>
            </div>

            <div className="function-item">
              <span>ฟังก์ชันข้อความ:</span>
              <button className={`toggle-btn-minimal${enableText ? " on" : " off"}`}
                onClick={handleToggleText}
                disabled={!systemOn}>
                {enableText ? "เปิด" : "ปิด"}
              </button>
            </div>

            <div className="function-item">
              <span>ฟังก์ชันส่งของขวัญ:</span>
              <button className={`toggle-btn-minimal${enableGift ? " on" : " off"}`}
                onClick={handleToggleGift}
                disabled={!systemOn}>
                {enableGift ? "เปิด" : "ปิด"}
              </button>
            </div>

            <div className="function-item">
              <span>ฟังก์ชันอวยพรวันเกิด:</span>
              <button className={`toggle-btn-minimal${enableBirthday ? " on" : " off"}`}
                onClick={handleToggleBirthday}
                disabled={!systemOn}>
                {enableBirthday ? "เปิด" : "ปิด"}
              </button>
            </div>
          </div>
        </section>
      </div>
      </main>
    </div>
  );
}

export default Home;