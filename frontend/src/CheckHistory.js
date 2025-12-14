import React, { useEffect, useState } from "react";
import "./CheckHistory.css";

function CheckHistory() {
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = () => {
    fetch("http://localhost:5001/api/check-history")
      .then((res) => res.json())
      .then((data) => setHistory(data));
  };

  const handleDelete = async (id) => {
    if (!window.confirm("ยืนยันการลบรายการนี้?")) return;
    await fetch("http://localhost:5001/api/delete-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchHistory();
  };

  const handleDeleteAll = async () => {
    if (!window.confirm("ยืนยันการลบประวัติทั้งหมด?")) return;
    await fetch("http://localhost:5001/api/delete-all-history", {
      method: "POST",
    });
    fetchHistory();
  };

  const textHistory = history.filter((item) => item.type === "text" || item.type === "gift");
  const imageHistory = history.filter((item) => item.type === "image" || item.type === "birthday");

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("th-TH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Modal แสดงรายละเอียด
  const DetailModal = ({ item, onClose }) => (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.3)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 32,
          minWidth: 320,
          maxWidth: 400,
          boxShadow: "0 2px 24px 0 rgba(30,41,59,.18)",
        }}
      >
        <h2
          style={{
            fontSize: 20,
            marginBottom: 16,
            color: "#1e293b",
          }}
        >
          รายละเอียดรายการ
        </h2>
        <div style={{ marginBottom: 8 }}>
          <b>ID:</b> {item.id}
        </div>
        {item.type && (
          <div style={{ marginBottom: 8 }}>
            <b>ประเภท:</b> {item.type}
          </div>
        )}
        {item.text && (
          <div style={{ marginBottom: 8 }}>
            <b>ข้อความ:</b> {item.text}
          </div>
        )}
        {item.filePath && (
          <div style={{ marginBottom: 8 }}>
            <b>รูปภาพ:</b>
            <br />
            <img
              src={`http://localhost:5001${item.filePath}`}
              alt="img"
              style={{
                maxWidth: 180,
                borderRadius: 8,
                marginTop: 4,
              }}
            />
          </div>
        )}
        {item.status && (
          <div style={{ marginBottom: 8 }}>
            <b>สถานะ:</b> {item.status === "approved" ? "อนุมัติ" : "ปฏิเสธ"}
          </div>
        )}
        {item.sender && (
          <div style={{ marginBottom: 8 }}>
            <b>ผู้ส่ง:</b> {item.sender}
          </div>
        )}
        {item.price !== undefined && (
          <div style={{ marginBottom: 8 }}>
            <b>ราคา:</b> {item.price}
          </div>
        )}
        {item.createdAt && (
          <div style={{ marginBottom: 8 }}>
            <b>เวลาสร้าง:</b> {formatDate(item.createdAt)}
          </div>
        )}
        {item.checkedAt && (
          <div style={{ marginBottom: 8 }}>
            <b>เวลาตรวจสอบ:</b> {formatDate(item.checkedAt)}
          </div>
        )}
        <button
          onClick={onClose}
          style={{
            marginTop: 16,
            padding: "0.5rem 1.5rem",
            background: "#64748b",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          ปิด
        </button>
      </div>
    </div>
  );

  return (
    <div className="ch-main-bg">
      <header className="ch-header">
        <div className="ch-header-title">CMS ADMIN</div>
        <div className="ch-header-center">ประวัติการตรวจสอบ</div>
        <div style={{ flex: 1 }}></div>
      </header>
      <main style={{ marginTop: "110px", width: "100%" }}>
        <div
          style={{
            width: "100%",
            maxWidth: 1020,
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
            marginTop: 8,
          }}
        >
          <button
            className={`ch-btn ch-btn-edit${editMode ? " active" : ""
              }`}
            onClick={() => setEditMode((v) => !v)}
          >
            {editMode ? "ปิดโหมดแก้ไข" : "แก้ไข"}
          </button>
          <button
            className="ch-btn ch-btn-deleteall"
            onClick={handleDeleteAll}
          >
            ลบทั้งหมด
          </button>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: "2rem",
            width: "100%",
            justifyContent: "center",
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          {/* กรอบซ้าย (ข้อความ) */}
          <div className="ch-card">
            <div className="ch-card-header">
              รายละเอียดการตรวจสอบ{" "}
              <span style={{ color: "#ec4899" }}>ข้อความ</span>
            </div>
            {textHistory.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  color: "#94a3b8",
                  padding: "3rem 0",
                  fontSize: "1.125rem",
                }}
              >
                ไม่มีประวัติการตรวจสอบข้อความ
              </div>
            ) : (
              textHistory.map((item, idx) => (
                <div className="ch-card-section" key={item.id}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <div style={{ color: "#1e293b" }}>
                      <b>เวลา:</b> {formatDate(item.checkedAt)}
                    </div>
                    <div style={{ color: "#1e293b" }}>
                      <b>รายละเอียด:</b> {item.text}
                    </div>
                    <div style={{ color: "#1e293b" }}>
                      <b>สถานะ:</b> {item.status === "approved" ? "อนุมัติ" : "ปฏิเสธ"}
                    </div>
                    <button
                      className="ch-btn-detail"
                      onClick={() => {
                        setSelected(item);
                        setShowModal(true);
                      }}
                    >
                      ตรวจสอบรายละเอียด
                    </button>
                  </div>
                  {editMode && (
                    <button
                      className="ch-btn-delete"
                      onClick={() => handleDelete(item.id)}
                    >
                      ลบ
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
          {/* กรอบขวา (รูปภาพ) */}
          <div className="ch-card">
            <div className="ch-card-header">
              รายละเอียดการตรวจสอบ{" "}
              <span style={{ color: "#6366f1" }}>รูปภาพ</span>
            </div>
            {imageHistory.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  color: "#94a3b8",
                  padding: "3rem 0",
                  fontSize: "1.125rem",
                }}
              >
                ไม่มีประวัติการตรวจสอบรูปภาพ
              </div>
            ) : (
              imageHistory.map((item, idx) => (
                <div className="ch-card-section" key={item.id}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <div style={{ color: "#1e293b" }}>
                      <b>เวลา:</b> {formatDate(item.checkedAt)}
                    </div>
                    <div style={{ color: "#1e293b" }}>
                      <b>รายละเอียด:</b> {item.text}
                    </div>
                    <div style={{ color: "#1e293b" }}>
                      <b>สถานะ:</b> {item.status === "approved" ? "อนุมัติ" : "ปฏิเสธ"}
                    </div>
                    {item.filePath && (
                      <div>
                        <img
                          src={`http://localhost:5001${item.filePath}`}
                          alt="img"
                          style={{
                            maxWidth: 180,
                            marginTop: 8,
                            borderRadius: 8,
                            boxShadow: "0 1px 4px 0 rgba(30,41,59,.08)",
                          }}
                        />
                      </div>
                    )}
                    <button
                      className="ch-btn-detail"
                      onClick={() => {
                        setSelected(item);
                        setShowModal(true);
                      }}
                    >
                      ตรวจสอบรายละเอียด
                    </button>
                  </div>
                  {editMode && (
                    <button
                      className="ch-btn-delete"
                      onClick={() => handleDelete(item.id)}
                    >
                      ลบ
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
      {showModal && selected && (
        <div className="ch-modal-bg">
          <div className="ch-modal-content">
            <h2
              style={{
                fontSize: 20,
                marginBottom: 16,
                color: "#1e293b",
              }}
            >
              รายละเอียดรายการ
            </h2>
            <div style={{ marginBottom: 8 }}>
              <b>ID:</b> {selected.id}
            </div>
            {selected.type && (
              <div style={{ marginBottom: 8 }}>
                <b>ประเภท:</b> {selected.type}
              </div>
            )}
            {selected.text && (
              <div style={{ marginBottom: 8 }}>
                <b>ข้อความ:</b> {selected.text}
              </div>
            )}
            {selected.filePath && (
              <div style={{ marginBottom: 8 }}>
                <b>รูปภาพ:</b>
                <br />
                <img
                  src={`http://localhost:5001${selected.filePath}`}
                  alt="img"
                  style={{
                    maxWidth: 180,
                    borderRadius: 8,
                    marginTop: 4,
                  }}
                />
              </div>
            )}
            {selected.status && (
              <div style={{ marginBottom: 8 }}>
                <b>สถานะ:</b> {selected.status === "approved" ? "อนุมัติ" : "ปฏิเสธ"}
              </div>
            )}
            {selected.sender && (
              <div style={{ marginBottom: 8 }}>
                <b>ผู้ส่ง:</b> {selected.sender}
              </div>
            )}
            {selected.price !== undefined && (
              <div style={{ marginBottom: 8 }}>
                <b>ราคา:</b> {selected.price}
              </div>
            )}
            {selected.createdAt && (
              <div style={{ marginBottom: 8 }}>
                <b>เวลาสร้าง:</b> {formatDate(selected.createdAt)}
              </div>
            )}
            {selected.checkedAt && (
              <div style={{ marginBottom: 8 }}>
                <b>เวลาตรวจสอบ:</b> {formatDate(selected.checkedAt)}
              </div>
            )}
            <button
              className="ch-btn"
              style={{ background: "#64748b", marginTop: 16 }}
              onClick={() => setShowModal(false)}
            >
              ปิด
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CheckHistory;
