/**
 * LuckyWheel — Presentational Componentสำหรับวงล้อเสี่ยงดวง
 * ดึงตรรกะและการประมวลผลออกไปไว้ที่ hooks/useLuckyWheel.js
 */
import React from "react";
import BackNavLink from "../ui/BackNavLink";
import useLuckyWheel from "../../hooks/useLuckyWheel";
import "./LuckyWheel.css";

const defaultColors = [
  "#f87171", "#fbbf24", "#34d399", "#60a5fa", "#a78bfa", "#f472b6", "#facc15", "#4ade80", "#38bdf8", "#818cf8"
];

export default function LuckyWheel() {
  const {
    segments,
    input,
    setInput,
    tableRange,
    setTableRange,
    spinning,
    winner,
    editIndex,
    setEditIndex,
    editValue,
    setEditValue,
    showPopup,
    popupEffect,
    reward,
    setReward,
    previewing,
    textareaRef,
    wheelRef,
    togglePreview,
    handleAddFromTextarea,
    handleAddTables,
    handleDelete,
    handleDeleteAll,
    handleEdit,
    handleEditSave,
    spinWheel,
    closePopup,
    removeWinnerAndRespin
  } = useLuckyWheel();

  const renderWheel = () => {
    const segs = segments.length;
    const arc = 2 * Math.PI / segs;
    const radius = 160;
    const viewBox = 360;
    const center = viewBox / 2;

    return (
      <svg width={viewBox} height={viewBox} viewBox={`0 0 ${viewBox} ${viewBox}`}>
        <g transform={`translate(${center},${center})`}>
          {segments.map((seg, i) => {
            const startAngle = i * arc - Math.PI / 2;
            const endAngle = (i + 1) * arc - Math.PI / 2;
            const x1 = radius * Math.cos(startAngle);
            const y1 = radius * Math.sin(startAngle);
            const x2 = radius * Math.cos(endAngle);
            const y2 = radius * Math.sin(endAngle);
            const largeArc = arc > Math.PI ? 1 : 0;
            const pathData = `
              M 0 0
              L ${x1} ${y1}
              A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}
              Z
            `;
            return (
              <g key={i}>
                <path
                  d={pathData}
                  fill={defaultColors[i % defaultColors.length]}
                  stroke="#fff"
                  strokeWidth="2"
                />
                <text
                  x={((radius + 20) / 2) * Math.cos(startAngle + arc / 2)}
                  y={((radius + 20) / 2) * Math.sin(startAngle + arc / 2)}
                  textAnchor="middle"
                  alignmentBaseline="middle"
                  fontSize={segments.length > 20 ? 12 : 16}
                  fill="#222"
                  transform={`rotate(${(startAngle + arc / 2) * 180 / Math.PI},${((radius + 20) / 2) * Math.cos(startAngle + arc / 2)},${((radius + 20) / 2) * Math.sin(startAngle + arc / 2)})`}
                  style={{ userSelect: "none", pointerEvents: "none" }}
                >
                  {seg.length > 16 ? seg.slice(0, 14) + "…" : seg}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    );
  };

  return (
    <div className="lucky-wheel-page">
      <header className="lucky-wheel-header">
        <div className="lucky-header-left">
          <BackNavLink />
          <div>
            <h1 className="header-title">🎡 Lucky Wheel</h1>
            <p className="header-subtitle">วงล้อเสี่ยงดวงสำหรับกิจกรรมพิเศษ</p>
          </div>
        </div>
      </header>

      <div className="lucky-wheel-flex">
        <div className="lucky-wheel-left">
          <div className="wheel-area">
            <div className="wheel-pointer-container">
              <svg width="36" height="36">
                <polygon
                  points="18,24 28,0 18,6 8,0"
                  fill="#fbbf24"
                  stroke="#eab308"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <div className="wheel-svg" ref={wheelRef}>
              {renderWheel()}
            </div>
          </div>

          <div className="wheel-action-row">
            <button
              className="spin-btn"
              onClick={togglePreview}
              disabled={spinning || segments.length === 0}
            >
              {previewing ? "👁️ ปิดจอ OBS" : "👁️ แสดงจอ OBS"}
            </button>

            <button
              className="spin-btn"
              onClick={spinWheel}
              disabled={spinning || segments.length < 2}
            >
              {spinning ? "🎡 กำลังหมุน..." : "🎯 หมุนวงล้อ"}
            </button>
          </div>

          <div className="reward-row">
            <label>🎁 ของรางวัล:</label>
            <input
              type="text"
              className="reward-input"
              placeholder="กรอกของรางวัล..."
              value={reward}
              onChange={e => setReward(e.target.value)}
              disabled={spinning}
            />
          </div>
        </div>
        
        <div className="lucky-wheel-right">
          <div className="wheel-config-header">
            <h3>⚙️ ตั้งค่า</h3>
            <button
              className="delete-all-btn"
              onClick={handleDeleteAll}
              disabled={spinning || segments.length === 0}
            >
              ลบทั้งหมด
            </button>
          </div>
          <textarea
            ref={textareaRef}
            className="wheel-textarea"
            placeholder="พิมพ์ชื่อแต่ละช่อง↵"
            value={input}
            onChange={e => setInput(e.target.value)}
            rows={6}
            disabled={spinning}
          />
          <button
            className="add-btn"
            onClick={handleAddFromTextarea}
            disabled={spinning || !input.trim()}
          >
            ➕ เพิ่มช่อง
          </button>
          <div className="table-range-row">
            <input
              type="number"
              className="table-range-input"
              placeholder="จาก"
              value={tableRange.from}
              onChange={e => setTableRange({ ...tableRange, from: e.target.value })}
              disabled={spinning}
            />
            <input
              type="number"
              className="table-range-input"
              placeholder="ถึง"
              value={tableRange.to}
              onChange={e => setTableRange({ ...tableRange, to: e.target.value })}
              disabled={spinning}
            />
            <button
              className="add-tables-btn"
              onClick={handleAddTables}
              disabled={spinning || !tableRange.from || !tableRange.to}
            >
              เพิ่มโต๊ะ
            </button>
          </div>
          <div className="wheel-edit-list">
            {segments.map((seg, idx) => (
              <div key={idx} className="wheel-segment-edit">
                {editIndex === idx ? (
                  <>
                    <input
                      className="segment-edit-input"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleEditSave(idx)}
                      autoFocus
                    />
                    <button className="segment-edit-btn" onClick={() => handleEditSave(idx)}>✓</button>
                    <button className="segment-edit-btn" onClick={() => setEditIndex(null)}>✕</button>
                  </>
                ) : (
                  <>
                    <span>{seg}</span>
                    <button className="segment-edit-btn" onClick={() => handleEdit(idx)} disabled={spinning}>✎</button>
                    <button className="segment-edit-btn" onClick={() => handleDelete(idx)} disabled={spinning}>✕</button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {showPopup && winner !== null && (
          <div className={`winner-popup ${popupEffect ? "show" : ""}`} onClick={closePopup}>
            <div className="winner-popup-content" onClick={(e) => e.stopPropagation()}>
              <div className="winner-firework">✨</div>
              <div className="winner-title">🎉 ผลลัพธ์การสุ่ม</div>
              <div className="winner-name">{segments[winner]}</div>
              <div className="winner-reward">
                {reward && (
                  <>
                    <span>🎁 ของรางวัล:</span>
                    <span className="winner-reward-value">{reward}</span>
                  </>
                )}
              </div>
              <div className="winner-firework">✨</div>
              <div className="popup-btn-group">
                {segments.length > 2 && (
                  <button
                    className="winner-close-btn winner-respin-btn"
                    onClick={removeWinnerAndRespin}
                  >
                    🔄 ตัดชื่อ + สุ่มใหม่
                  </button>
                )}
                <button className="winner-close-btn" onClick={closePopup}>ปิด</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
