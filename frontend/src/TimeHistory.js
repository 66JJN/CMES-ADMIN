import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";

function TimeHistory() {
  const [history, setHistory] = useState([]);
  const socketRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch("http://localhost:4005/api/check-history");
        if (response.ok) {
          const data = await response.json();
          console.log("[TimeHistory] Fetched history:", data);
          setHistory(data);
        }
      } catch (error) {
        console.error("[TimeHistory] Error fetching history:", error);
      }
    };

    fetchHistory();
    const interval = setInterval(fetchHistory, 5000);

    socketRef.current = io("http://localhost:4005");
    socketRef.current.on("status", (data) => {
      console.log("[TimeHistory] Received status event, refetching...");
      fetchHistory();
    });

    // ฟัง event เมื่อมีการลบข้อมูลจาก realtime-server
    socketRef.current.on("settingsUpdated", (data) => {
      console.log("[TimeHistory] Settings updated event received:", data);
      fetchHistory();
    });
    
    return () => {
      clearInterval(interval);
      socketRef.current.disconnect();
    };
  }, []);

  const textHistory = history.filter((item) => item.mode === "text");
  const imageHistory = history.filter((item) => item.mode === "image");
  const birthdayHistory = history.filter((item) => item.mode === "birthday");

  const handleRemove = (id) => {
    socketRef.current.emit("removeSetting", id);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        fontFamily: "'Segoe UI', Arial, sans-serif",
        position: "relative",
      }}
    >
      {/* พื้นหลังฟ้าอ่อนให้เต็มจอและอยู่ใต้ header */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 0,
          background: "linear-gradient(120deg, #e0e7ff 0%, #f9fafb 100%)",
        }}
      />
      {/* Header เหมือนหน้า Home */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          maxWidth: "100vw",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.2rem 2.5rem",
          boxSizing: "border-box",
          background: "#fff",
          boxShadow: "0 2px 12px rgba(30, 41, 59, 0.08)",
        }}
      >
        <div
          style={{
            fontSize: "2.2rem",
            color: "#1a237e",
            fontWeight: "bold",
            textAlign: "left",
            flex: 1,
          }}
        >
          CMS ADMIN
        </div>
        <div
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: "1.25rem",
            color: "#222",
            fontWeight: "500",
            userSelect: "none",
            letterSpacing: "1px",
          }}
        >
          ประวัติการตั้งเวลา
        </div>
        <div style={{ flex: 1 }}></div>
      </header>

      {/* Main content */}
      <main
        style={{
          marginTop: "110px",
          width: "100%",
          minHeight: "calc(100vh - 110px)",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          className="w-full max-w-5xl flex flex-col md:flex-row gap-8"
          style={{
            width: "100%",
            maxWidth: "1200px",
            display: "flex",
            flexDirection: "row",
            gap: "2rem",
            justifyContent: "center",
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          {/* กรอบซ้าย (ข้อความ) */}
          <div
            className="flex-1 bg-white rounded-2xl shadow-xl border border-blue-200 flex flex-col min-w-[280px] max-w-xl"
            style={{
              flex: 1,
              background: "#fff",
              borderRadius: "1rem",
              boxShadow: "0 2px 24px 0 rgba(30,41,59,.08)",
              border: "1px solid #90caf9",
              minWidth: 280,
              maxWidth: 500,
              margin: 0,
              width: "100%",
            }}
          >
            <div
              className="text-xl font-bold text-blue-900 text-center py-4 border-b border-blue-100 rounded-t-2xl"
              style={{
                fontSize: "1.25rem",
                fontWeight: "bold",
                color: "#1e293b",
                textAlign: "center",
                padding: "1rem 0",
                borderBottom: "1px solid #bbdefb",
                borderTopLeftRadius: "1rem",
                borderTopRightRadius: "1rem",
              }}
            >
              รายละเอียดการตั้งค่า{" "}
              <span style={{ color: "#ec4899" }}>ข้อความ</span>
            </div>
            {textHistory.length === 0 ? (
              <div
                className="text-center text-gray-400 py-12 text-lg"
                style={{
                  textAlign: "center",
                  color: "#94a3b8",
                  padding: "3rem 0",
                  fontSize: "1.125rem",
                }}
              >
                ไม่มีประวัติการตั้งค่าข้อความ
              </div>
            ) : (
              textHistory.map((item, idx) => (
                <div
                  key={item.id}
                  className={`flex flex-col gap-2 px-8 py-6 ${
                    idx !== textHistory.length - 1 ? "border-b border-blue-100" : ""
                  }`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    padding: "1.5rem 2rem",
                    borderBottom:
                      idx !== textHistory.length - 1 ? "1px solid #bbdefb" : "none",
                  }}
                >
                  <div className="flex flex-col gap-2">
                    <div className="text-gray-700 flex items-center gap-2">
                      <span style={{ fontSize: "1.125rem" }}>🕒</span>
                      <span style={{ fontWeight: "500" }}>วันที่ตั้งเวลา:</span>
                      <span>{item.date}</span>
                    </div>
                    <div className="text-gray-700 flex items-center gap-2">
                      <span style={{ fontSize: "1.125rem" }}>⏱</span>
                      <span style={{ fontWeight: "500" }}>ระยะเวลาแสดงผล:</span>
                      <span>{item.duration}</span>
                    </div>
                    <div className="text-gray-700 flex items-center gap-2">
                      <span style={{ fontSize: "1.125rem" }}>💵</span>
                      <span style={{ fontWeight: "500" }}>ราคา:</span>
                      <span>{item.price}</span>
                    </div>
                  </div>
                  <button
                    className="self-end bg-red-500 hover:bg-red-600 text-white px-5 py-1.5 rounded font-semibold shadow-sm transition mt-2"
                    style={{
                      alignSelf: "flex-end",
                      background: "#ef4444",
                      color: "#fff",
                      padding: "0.375rem 1.25rem",
                      borderRadius: "0.375rem",
                      fontWeight: "600",
                      marginTop: "0.5rem",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                      border: "none",
                      cursor: "pointer",
                      transition: "background 0.2s",
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.background = "#dc2626")}
                    onMouseOut={(e) => (e.currentTarget.style.background = "#ef4444")}
                    onClick={() => handleRemove(item.id)} // คอมเมนต์หรือเอาออก
                  >
                    REMOVE
                  </button>
                </div>
              ))
            )}
          </div>
          {/* กรอบขวา (รูปภาพ) */}
          <div
            className="flex-1 bg-white rounded-2xl shadow-xl border border-blue-200 flex flex-col min-w-[280px] max-w-xl"
            style={{
              flex: 1,
              background: "#fff",
              borderRadius: "1rem",
              boxShadow: "0 2px 24px 0 rgba(30,41,59,.08)",
              border: "1px solid #90caf9",
              minWidth: 280,
              maxWidth: 500,
              margin: 0,
              width: "100%",
            }}
          >
            <div
              className="text-xl font-bold text-blue-900 text-center py-4 border-b border-blue-100 rounded-t-2xl"
              style={{
                fontSize: "1.25rem",
                fontWeight: "bold",
                color: "#1e293b",
                textAlign: "center",
                padding: "1rem 0",
                borderBottom: "1px solid #bbdefb",
                borderTopLeftRadius: "1rem",
                borderTopRightRadius: "1rem",
              }}
            >
              รายละเอียดการตั้งค่า{" "}
              <span style={{ color: "#6366f1" }}>รูปภาพ</span>
            </div>
            {imageHistory.length === 0 ? (
              <div
                className="text-center text-gray-400 py-12 text-lg"
                style={{
                  textAlign: "center",
                  color: "#94a3b8",
                  padding: "3rem 0",
                  fontSize: "1.125rem",
                }}
              >
                ไม่มีประวัติการตั้งค่ารูปภาพ
              </div>
            ) : (
              imageHistory.map((item, idx) => (
                <div
                  key={item.id}
                  className={`flex flex-col gap-2 px-8 py-6 ${
                    idx !== imageHistory.length - 1 ? "border-b border-blue-100" : ""
                  }`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    padding: "1.5rem 2rem",
                    borderBottom:
                      idx !== imageHistory.length - 1 ? "1px solid #bbdefb" : "none",
                  }}
                >
                  <div className="flex flex-col gap-2">
                    <div className="text-gray-700 flex items-center gap-2">
                      <span style={{ fontSize: "1.125rem" }}>🕒</span>
                      <span style={{ fontWeight: "500" }}>วันที่ตั้งเวลา:</span>
                      <span>{item.date}</span>
                    </div>
                    <div className="text-gray-700 flex items-center gap-2">
                      <span style={{ fontSize: "1.125rem" }}>⏱</span>
                      <span style={{ fontWeight: "500" }}>ระยะเวลาแสดงผล:</span>
                      <span>{item.duration}</span>
                    </div>
                    <div className="text-gray-700 flex items-center gap-2">
                      <span style={{ fontSize: "1.125rem" }}>💵</span>
                      <span style={{ fontWeight: "500" }}>ราคา:</span>
                      <span>{item.price}</span>
                    </div>
                  </div>
                  <button
                    className="self-end bg-red-500 hover:bg-red-600 text-white px-5 py-1.5 rounded font-semibold shadow-sm transition mt-2"
                    style={{
                      alignSelf: "flex-end",
                      background: "#ef4444",
                      color: "#fff",
                      padding: "0.375rem 1.25rem",
                      borderRadius: "0.375rem",
                      fontWeight: "600",
                      marginTop: "0.5rem",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                      border: "none",
                      cursor: "pointer",
                      transition: "background 0.2s",
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.background = "#dc2626")}
                    onMouseOut={(e) => (e.currentTarget.style.background = "#ef4444")}
                    onClick={() => handleRemove(item.id)} // คอมเมนต์หรือเอาออก
                  >
                    REMOVE
                  </button>
                </div>
              ))
            )}
          </div>
          {/* กรอบวันเกิด */}
          <div
            className="flex-1 bg-white rounded-2xl shadow-xl border border-blue-200 flex flex-col min-w-[280px] max-w-xl"
            style={{
              flex: 1,
              background: "#fff",
              borderRadius: "1rem",
              boxShadow: "0 2px 24px 0 rgba(30,41,59,.08)",
              border: "1px solid #90caf9",
              minWidth: 280,
              maxWidth: 500,
              margin: 0,
              width: "100%",
            }}
          >
            <div
              className="text-xl font-bold text-blue-900 text-center py-4 border-b border-blue-100 rounded-t-2xl"
              style={{
                fontSize: "1.25rem",
                fontWeight: "bold",
                color: "#1e293b",
                textAlign: "center",
                padding: "1rem 0",
                borderBottom: "1px solid #bbdefb",
                borderTopLeftRadius: "1rem",
                borderTopRightRadius: "1rem",
              }}
            >
              รายละเอียดการตั้งค่า{" "}
              <span style={{ color: "#f59e0b" }}>วันเกิด</span>
            </div>
            {birthdayHistory.length === 0 ? (
              <div
                className="text-center text-gray-400 py-12 text-lg"
                style={{
                  textAlign: "center",
                  color: "#94a3b8",
                  padding: "3rem 0",
                  fontSize: "1.125rem",
                }}
              >
                ไม่มีประวัติการตั้งค่าวันเกิด
              </div>
            ) : (
              birthdayHistory.map((item, idx) => (
                <div
                  key={item.id}
                  className={`flex flex-col gap-2 px-8 py-6 ${
                    idx !== birthdayHistory.length - 1 ? "border-b border-blue-100" : ""
                  }`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    padding: "1.5rem 2rem",
                    borderBottom:
                      idx !== birthdayHistory.length - 1 ? "1px solid #bbdefb" : "none",
                  }}
                >
                  <div className="flex flex-col gap-2">
                    <div className="text-gray-700 flex items-center gap-2">
                      <span style={{ fontSize: "1.125rem" }}>🕒</span>
                      <span style={{ fontWeight: "500" }}>วันที่ตั้งเวลา:</span>
                      <span>{item.date}</span>
                    </div>
                    <div className="text-gray-700 flex items-center gap-2">
                      <span style={{ fontSize: "1.125rem" }}>⏱</span>
                      <span style={{ fontWeight: "500" }}>ระยะเวลาแสดงผล:</span>
                      <span>{item.duration}</span>
                    </div>
                    <div className="text-gray-700 flex items-center gap-2">
                      <span style={{ fontSize: "1.125rem" }}>💵</span>
                      <span style={{ fontWeight: "500" }}>ราคา:</span>
                      <span>{item.price}</span>
                    </div>
                  </div>
                  <button
                    className="self-end bg-red-500 hover:bg-red-600 text-white px-5 py-1.5 rounded font-semibold shadow-sm transition mt-2"
                    style={{
                      alignSelf: "flex-end",
                      background: "#ef4444",
                      color: "#fff",
                      padding: "0.375rem 1.25rem",
                      borderRadius: "0.375rem",
                      fontWeight: "600",
                      marginTop: "0.5rem",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                      border: "none",
                      cursor: "pointer",
                      transition: "background 0.2s",
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.background = "#dc2626")}
                    onMouseOut={(e) => (e.currentTarget.style.background = "#ef4444")}
                    onClick={() => handleRemove(item.id)}
                  >
                    REMOVE
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default TimeHistory;
