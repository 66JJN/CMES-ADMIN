import React from "react";
import "./OBSControlPanel.css";

/**
 * Presentational Component for OBS Studio Web Controller.
 * Pure UI driven entirely by props with zero business logic or inline styles.
 */
export default function OBSControlPanel({
  url,
  setUrl,
  password,
  setPassword,
  isConnected,
  scenes,
  currentScene,
  marqueeText,
  setMarqueeText,
  bgmMuted,
  logs,
  overlayItems,
  dragging,
  canvasRef,
  logsEndRef,
  handleConnect,
  handleSceneSwitch,
  handleEmergencyHide,
  handleMarqueeUpdate,
  handleToggleMute,
  handleCanvasMouseDown,
  handleCanvasMouseMove,
  handleCanvasMouseUp,
}) {
  return (
    <div className="obs-dashboard">
      <div className="obs-header-bar">
        <div className="obs-title">
          <span className="obs-icon">🎛️</span>
          <h2>OBS Web Controller</h2>
          <span className={`obs-status-badge ${isConnected ? "online" : "offline"}`}>
            {isConnected ? "ONLINE" : "OFFLINE"}
          </span>
        </div>

        <div className="obs-connection-compact">
          <input
            type="text"
            placeholder="ws://localhost:4455"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isConnected}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isConnected}
          />
          <button
            className={`obs-connect-btn ${isConnected ? "disconnect" : "connect"}`}
            onClick={handleConnect}
          >
            {isConnected ? "Disconnect" : "Connect"}
          </button>
        </div>
      </div>

      {isConnected ? (
        <div className="obs-studio-layout">
          {/* ====== Interactive Scene Canvas ====== */}
          <div className="obs-canvas-wrapper">
            <div className="obs-canvas-header">
              <div className="obs-canvas-header-left">
                <span className="obs-canvas-live-dot" />
                <span>Scene: <strong>{currentScene}</strong></span>
                <span className="obs-canvas-item-count">{Object.keys(overlayItems).length} sources</span>
              </div>
              <span className="obs-canvas-hint">🖱️ ลากเพื่อย้ายตำแหน่ง — ปล่อยเพื่ออัปเดต OBS</span>
            </div>
            <div
              className="obs-canvas"
              ref={canvasRef}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
            >
              {Object.entries(overlayItems).map(([sourceName, item]) => {
                const leftPct = (item.x / 1920) * 100;
                const topPct = (item.y / 1080) * 100;
                return (
                  <div
                    key={sourceName}
                    className={`obs-overlay-pin${dragging === sourceName ? " dragging" : ""}${!item.enabled ? " hidden" : ""}`}
                    style={{
                      left: `clamp(0%, ${leftPct}%, 88%)`,
                      top: `clamp(0%, ${topPct}%, 85%)`,
                    }}
                    onMouseDown={(e) => handleCanvasMouseDown(e, sourceName)}
                  >
                    <span className="obs-pin-label">{sourceName}</span>
                    <span className="obs-pin-coords">{Math.round(item.x)}, {Math.round(item.y)}</span>
                  </div>
                );
              })}
              {Object.keys(overlayItems).length === 0 && (
                <div className="obs-canvas-empty">ไม่พบ Source ใน Scene นี้</div>
              )}
            </div>
          </div>

          {/* ====== Bottom: 4 Docks Panel like OBS Studio ====== */}
          <div className="obs-docks-container">
            {/* Dock 1: Scenes */}
            <div className="obs-dock">
              <div className="obs-dock-header">Scenes</div>
              <div className="obs-dock-content obs-scene-list">
                {scenes.length > 0 ? (
                  scenes.map((scene) => (
                    <button
                      key={scene}
                      className={`obs-scene-list-item ${currentScene === scene ? "active" : ""}`}
                      onClick={() => handleSceneSwitch(scene)}
                    >
                      <span className="scene-icon">📺</span> {scene}
                    </button>
                  ))
                ) : (
                  <p className="obs-empty">No scenes found</p>
                )}
              </div>
            </div>

            {/* Dock 2: Sources & Overlays */}
            <div className="obs-dock">
              <div className="obs-dock-header">Sources & Overlays</div>
              <div className="obs-dock-content obs-sources-dock">
                <div className="obs-source-item">
                  <div className="obs-source-info">
                    <span className="source-icon">🖼️</span>
                    <span className="source-name">Overlay_ImageText</span>
                  </div>
                  <div className="obs-source-actions">
                    <button className="obs-eye-btn" title="แสดง" onClick={() => handleEmergencyHide("Overlay_ImageText", true)}>👁️</button>
                    <button className="obs-eye-btn hide" title="ซ่อน" onClick={() => handleEmergencyHide("Overlay_ImageText", false)}>🚫</button>
                  </div>
                </div>

                <div className="obs-source-item">
                  <div className="obs-source-info">
                    <span className="source-icon">🏆</span>
                    <span className="source-name">Overlay_Ranking</span>
                  </div>
                  <div className="obs-source-actions">
                    <button className="obs-eye-btn" title="แสดง" onClick={() => handleEmergencyHide("Overlay_Ranking", true)}>👁️</button>
                    <button className="obs-eye-btn hide" title="ซ่อน" onClick={() => handleEmergencyHide("Overlay_Ranking", false)}>🚫</button>
                  </div>
                </div>

                <div className="obs-source-item">
                  <div className="obs-source-info">
                    <span className="source-icon">🎡</span>
                    <span className="source-name">Overlay_LuckyWheel</span>
                  </div>
                  <div className="obs-source-actions">
                    <button className="obs-eye-btn" title="แสดง" onClick={() => handleEmergencyHide("Overlay_LuckyWheel", true)}>👁️</button>
                    <button className="obs-eye-btn hide" title="ซ่อน" onClick={() => handleEmergencyHide("Overlay_LuckyWheel", false)}>🚫</button>
                  </div>
                </div>

                {/* MarqueeText Control */}
                <div className="obs-source-marquee">
                  <label>📝 MarqueeText (ข้อความต้อนรับ)</label>
                  <div className="obs-marquee-input-group">
                    <input
                      type="text"
                      placeholder="พิมพ์ข้อความวิ่ง..."
                      value={marqueeText}
                      onChange={(e) => setMarqueeText(e.target.value)}
                    />
                    <div className="obs-marquee-btns">
                      <button className="btn-send" onClick={() => handleMarqueeUpdate(marqueeText)}>ส่งจอ</button>
                      <button className="btn-clear" onClick={() => handleMarqueeUpdate("")}>ลบ</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Dock 3: Audio Mixer */}
            <div className="obs-dock obs-audio-dock">
              <div className="obs-dock-header">Audio Mixer</div>
              <div className="obs-dock-content obs-audio-mixer">
                <div className="obs-audio-channel">
                  <div className="audio-label">BGM</div>
                  <div className="audio-slider-container">
                    {/* Mock Volume Bar */}
                    <div className={`audio-vu-meter ${bgmMuted ? "muted" : ""}`}>
                      <div className="vu-segment green"></div>
                      <div className="vu-segment green"></div>
                      <div className="vu-segment green"></div>
                      <div className="vu-segment yellow"></div>
                      <div className="vu-segment red"></div>
                    </div>
                  </div>
                  <button
                    className={`obs-btn-mute ${bgmMuted ? "muted" : "unmuted"}`}
                    onClick={handleToggleMute}
                    title={bgmMuted ? "Unmute" : "Mute"}
                  >
                    {bgmMuted ? "🔇 Muted" : "🔊 Active"}
                  </button>
                </div>
              </div>
            </div>

            {/* Dock 4: Controls & Terminal */}
            <div className="obs-dock">
              <div className="obs-dock-header">Controls & Logs</div>
              <div className="obs-dock-content obs-controls-dock">
                <button className="obs-main-action disconnect" onClick={handleConnect}>
                  Stop Connection
                </button>

                <div className="obs-terminal-mini">
                  <div className="obs-terminal-body-mini">
                    {logs.slice(-15).map((log, i) => (
                      <div key={i} className={`obs-log-line-mini ${log.type}`}>
                        <span className="log-time">[{log.time}]</span> {log.msg}
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="obs-not-connected">
          <p className="obs-not-connected-title">กรุณาเชื่อมต่อ OBS Studio เพื่อใช้งานแผงควบคุม</p>
          <div className="obs-instructions">
            <h4>📌 วิธีตั้งค่าใน OBS Studio (v28+)</h4>
            <ol>
              <li>เปิดโปรแกรม OBS Studio ไปที่เมนู <strong>Tools ➔ WebSocket Server Settings</strong></li>
              <li>ติ๊กถูกที่ <strong>"Enable WebSocket server"</strong></li>
              <li>ตั้งค่า Server Port (ค่าเริ่มต้น <strong>4455</strong>)</li>
              <li>ตั้งค่า <strong>Server Password</strong> ให้ตรงกับที่กรอกในเว็บ (หรือเอาติ๊กถูก Authentication ออกถ้าไม่ต้องการรหัสผ่าน)</li>
              <li>ระบบจะพยายาม <strong>สร้าง Source ให้คุณอัตโนมัติ</strong> (รวม 3 ลิงก์ Overlay, MarqueeText และ BGM) เมื่อกด Connect ทันที</li>
              <li>กด Apply และคลิก Connect ได้เลย!</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
