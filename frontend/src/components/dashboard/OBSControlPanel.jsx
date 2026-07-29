import React, { useState } from "react";
import "./OBSControlPanel.css";

const SOURCE_LABELS = [
  ["Overlay_ImageText", "ภาพและข้อความ", "🖼️"],
  ["Overlay_Ranking", "อันดับผู้สนับสนุน", "🏆"],
  ["Overlay_LuckyWheel", "วงล้อสุ่มรางวัล", "🎡"],
];

const PRESETS = [
  ["balanced", "สมดุล", "ขนาดพอดีสำหรับจอร้านส่วนใหญ่"],
  ["focus", "เน้นรูปภาพ", "ภาพเด่นขึ้น พร้อมข้อความกระชับ"],
  ["cinema", "พื้นหลังวิดีโอ", "การ์ดอ่านง่ายเมื่อมีวิดีโอด้านหลัง"],
];

const CARD_BACKGROUND_OPTIONS = [
  ["transparent", "ใส"],
  ["dim", "มืดโปร่ง"],
  ["blur", "เบลอโปร่ง"],
];

/** A simple operator panel: content appearance is saved per shop, while OBS
 * source controls remain available only after the local OBS connection works. */
export default function OBSControlPanel({
  url, setUrl, password, setPassword, isConnected,
  scenes, currentScene, marqueeText, setMarqueeText, bgmMuted, logs,
  overlayItems, dragging, canvasRef, logsEndRef,
  overlayStyle, isSavingOverlayStyle, saveDisplayProfiles,
  displayProfiles, activeDisplayProfile, activeDisplayId, selectDisplayProfile,
  updateActiveDisplayProfile, addDisplayProfile, removeActiveDisplayProfile,
  handleConnect, handleSceneSwitch, handleEmergencyHide, handleMarqueeUpdate,
  handleToggleMute, handleCanvasMouseDown, handleCanvasMouseMove, handleCanvasMouseUp,
}) {
  const [previewMode, setPreviewMode] = useState("image");
  const activeStyle = activeDisplayProfile?.overlayStyle || overlayStyle;
  const activePreviewBackground = previewMode === "image"
    ? activeStyle.imageBackgroundStyle
    : previewMode === "gift"
      ? activeStyle.giftBackgroundStyle
      : activeStyle.textBackgroundStyle;
  const updateStyle = (key, value) => updateActiveDisplayProfile({
    overlayStyle: { ...activeStyle, [key]: value },
  });
  const updateProfile = (key, value) => updateActiveDisplayProfile({ [key]: value });
  const resetStyle = () => updateActiveDisplayProfile({ overlayStyle: {
    preset: "balanced", imageFit: "contain", verticalPosition: "bottom",
    cardScale: 1, imageMaxWidth: 600, textScale: 1,
    imageBackgroundStyle: "transparent", textBackgroundStyle: "dim", giftBackgroundStyle: "dim",
  } });
  const previewStyle = {
    "--screen-aspect": `${Math.max(1, Number(activeDisplayProfile?.width) || 1920)} / ${Math.max(1, Number(activeDisplayProfile?.height) || 1080)}`,
    "--preview-card-scale": activeStyle.cardScale,
    "--preview-text-scale": activeStyle.textScale,
    "--preview-image-width": `${Math.min(76, Math.max(30, (Number(activeStyle.imageMaxWidth) || 600) / 10))}%`,
  };

  return (
    <section className="obs-panel" aria-label="OBS Studio controls">
      <header className="obs-panel__header">
        <div>
          <div className="obs-panel__eyebrow">ระบบควบคุมจอร้าน</div>
          <h2>ศูนย์ควบคุม OBS</h2>
          <p>จัดหน้าจอและควบคุมเนื้อหาบนจอผ่านเว็บได้ โดยไม่ต้องแก้ Source เอง</p>
        </div>
        <div className={`obs-connection-state ${isConnected ? "is-online" : "is-offline"}`}>
          <span className="obs-state-dot" />
          {isConnected ? "เชื่อมต่อ OBS แล้ว" : "ยังไม่เชื่อมต่อ OBS"}
        </div>
      </header>

      <div className="obs-connect-card">
        <div className="obs-connect-card__copy">
          <strong>{isConnected ? "เชื่อมต่อกับเครื่องที่เปิด OBS แล้ว" : "เชื่อมต่อ OBS บนเครื่องนี้"}</strong>
          <span>การเชื่อมต่อ OBS ใช้ได้จากเบราว์เซอร์ที่อยู่เครื่องหรือเครือข่ายเดียวกับ OBS เท่านั้น</span>
        </div>
        <div className="obs-connect-form">
          <input aria-label="OBS WebSocket URL" value={url} onChange={(event) => setUrl(event.target.value)} disabled={isConnected} placeholder="ws://localhost:4455" />
          <input aria-label="OBS WebSocket password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={isConnected} placeholder="WebSocket password" />
          <button type="button" className={`obs-primary-button ${isConnected ? "is-danger" : ""}`} onClick={handleConnect}>
            {isConnected ? "ตัดการเชื่อมต่อ" : "เชื่อมต่อ OBS"}
          </button>
        </div>
      </div>

      <section className="display-profile-card">
        <div className="obs-section-heading">
          <div>
            <span className="obs-section-kicker">โปรไฟล์จอร้าน</span>
            <h3>ตั้งค่าจอที่ใช้แสดง CMES</h3>
            <p>ความละเอียดและสัดส่วนมีผลต่อการจัดวางจริง ส่วนขนาดจอและระยะดูช่วยให้ทีมร้านประเมินความอ่านง่ายได้</p>
          </div>
          <button type="button" className="obs-primary-button" disabled={displayProfiles.length >= 8} onClick={addDisplayProfile}>+ เพิ่มจอ</button>
        </div>
        <div className="display-profile-tabs" role="tablist" aria-label="เลือกจอร้าน">
          {displayProfiles.map((profile) => <button type="button" role="tab" aria-selected={profile.id === activeDisplayId} key={profile.id} className={profile.id === activeDisplayId ? "is-active" : ""} onClick={() => selectDisplayProfile(profile.id)}><span>🖥️</span><strong>{profile.name}</strong><small>{profile.width} × {profile.height}</small></button>)}
        </div>
        <div className="display-profile-editor">
          <div className="display-profile-fields">
            <label className="obs-field"><span>ชื่อจอ</span><input value={activeDisplayProfile.name} maxLength="50" onChange={(event) => updateProfile("name", event.target.value)} placeholder="เช่น จอหลักหน้าเวที" /></label>
            <label className="obs-field"><span>ความกว้าง (px)</span><input type="number" min="640" max="7680" value={activeDisplayProfile.width} onChange={(event) => updateProfile("width", Number(event.target.value))} /></label>
            <label className="obs-field"><span>ความสูง (px)</span><input type="number" min="640" max="4320" value={activeDisplayProfile.height} onChange={(event) => updateProfile("height", Number(event.target.value))} /></label>
            <label className="obs-field"><span>ความกว้างจอจริง (ซม.) <em>ไม่บังคับ</em></span><input type="number" min="20" max="2000" value={activeDisplayProfile.physicalWidthCm ?? ""} onChange={(event) => updateProfile("physicalWidthCm", event.target.value === "" ? null : Number(event.target.value))} placeholder="เช่น 300" /></label>
            <label className="obs-field"><span>ระยะดูโดยเฉลี่ย (เมตร) <em>ไม่บังคับ</em></span><input type="number" min="0.5" max="100" step="0.5" value={activeDisplayProfile.viewingDistanceM ?? ""} onChange={(event) => updateProfile("viewingDistanceM", event.target.value === "" ? null : Number(event.target.value))} placeholder="เช่น 8" /></label>
            <label className="obs-field"><span>Scene ของ OBS</span><select value={activeDisplayProfile.obsSceneName} onChange={(event) => updateProfile("obsSceneName", event.target.value)} disabled={!isConnected}><option value="">{activeDisplayProfile.id === "main" ? "ใช้ Scene ที่กำลังแสดง" : "ยังไม่ได้ผูก Scene"}</option>{scenes.map((scene) => <option key={scene} value={scene}>{scene}</option>)}</select></label>
            <label className="display-enabled"><input type="checkbox" checked={activeDisplayProfile.enabled !== false} onChange={(event) => updateProfile("enabled", event.target.checked)} /><span>เปิดใช้งานจอนี้และสร้าง Source เมื่อเชื่อมต่อ OBS</span></label>
          </div>
          <div className="display-preview-wrap">
            <div className="display-preview-toolbar"><strong>ตัวอย่างบนจอจริง</strong><div>{[["image", "ภาพ"], ["text", "ข้อความ"], ["gift", "ของขวัญ"]].map(([mode, label]) => <button type="button" key={mode} className={previewMode === mode ? "is-active" : ""} onClick={() => setPreviewMode(mode)}>{label}</button>)}</div></div>
            <div className="display-preview-stage" style={previewStyle} data-position={activeStyle.verticalPosition}>
              <div className={`display-preview-card mode-${previewMode}`} data-fit={activeStyle.imageFit} data-background={activePreviewBackground}>
                {previewMode === "image" && <><div className="display-preview-image">ภาพตัวอย่าง</div><div className="display-preview-copy"><b>@ชื่อผู้ส่ง</b><span>ข้อความที่ต้องการแสดงบนจอ</span></div></>}
                {previewMode === "text" && <div className="display-preview-text">คืนนี้สนุกให้สุด แล้วพบกันใหม่ครับ</div>}
                {previewMode === "gift" && <div className="display-preview-gift"><span>🎁</span><b>คุณลูกค้าส่งของขวัญ</b><small>โต๊ะ 12 · เหลือเวลา 0:15</small></div>}
              </div>
            </div>
            <small className="display-preview-note">{activeDisplayProfile.width} × {activeDisplayProfile.height} · อัตราส่วน {(Number(activeDisplayProfile.width) / Number(activeDisplayProfile.height)).toFixed(2)}:1</small>
          </div>
        </div>
        {displayProfiles.length > 1 && <div className="display-profile-remove"><button type="button" className="obs-danger-link" onClick={removeActiveDisplayProfile}>ลบโปรไฟล์จอนี้</button></div>}
      </section>

      <div className="obs-template-card">
        <div className="obs-section-heading">
          <div>
            <span className="obs-section-kicker">บันทึกแยกตามร้าน</span>
            <h3>รูปแบบภาพและข้อความบนจอ</h3>
            <p>รูปทุกสัดส่วนจะอยู่ในกรอบเดียวกันด้วยโหมด <b>เห็นรูปครบ</b> เป็นค่าแนะนำ จึงไม่เล็กหรือใหญ่จนเสียสมดุล</p>
          </div>
          <div className="obs-template-preview" data-background={activeStyle.textBackgroundStyle}>
            <div className="obs-template-preview__image" data-fit={activeStyle.imageFit}>รูปภาพ</div>
            <div><b>ชื่อ Social</b><span>ข้อความบนจอ</span></div>
          </div>
        </div>

        <div className="obs-preset-grid" role="group" aria-label="Overlay presets">
          {PRESETS.map(([value, label, description]) => (
            <button key={value} type="button" className={`obs-preset ${activeStyle.preset === value ? "is-selected" : ""}`} onClick={() => updateStyle("preset", value)}>
              <strong>{label}</strong><span>{description}</span>
            </button>
          ))}
        </div>

        <div className="obs-style-grid">
          <label className="obs-field"><span>ภาพแสดงแบบ</span>
            <select value={activeStyle.imageFit} onChange={(event) => updateStyle("imageFit", event.target.value)}>
              <option value="contain">เห็นรูปครบ (แนะนำ)</option><option value="cover">เต็มกรอบ (อาจตัดขอบ)</option>
            </select>
          </label>
          <label className="obs-field"><span>ตำแหน่งบนจอ</span>
            <select value={activeStyle.verticalPosition} onChange={(event) => updateStyle("verticalPosition", event.target.value)}>
              <option value="bottom">ด้านล่าง</option><option value="middle">กึ่งกลาง</option><option value="top">ด้านบน</option>
            </select>
          </label>
          <label className="obs-field"><span>พื้นหลังการ์ดรูปภาพ</span>
            <select value={activeStyle.imageBackgroundStyle} onChange={(event) => updateStyle("imageBackgroundStyle", event.target.value)}>
              {CARD_BACKGROUND_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="obs-field"><span>พื้นหลังการ์ดข้อความ</span>
            <select value={activeStyle.textBackgroundStyle} onChange={(event) => updateStyle("textBackgroundStyle", event.target.value)}>
              {CARD_BACKGROUND_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="obs-field"><span>พื้นหลังการ์ดของขวัญ</span>
            <select value={activeStyle.giftBackgroundStyle} onChange={(event) => updateStyle("giftBackgroundStyle", event.target.value)}>
              {CARD_BACKGROUND_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="obs-range-field"><span>ขนาดการ์ด <b>{Math.round(Number(activeStyle.cardScale) * 100)}%</b></span>
            <input type="range" min="0.7" max="1.3" step="0.05" value={activeStyle.cardScale} onChange={(event) => updateStyle("cardScale", Number(event.target.value))} />
          </label>
          <label className="obs-range-field"><span>ความกว้างรูปสูงสุด <b>{activeStyle.imageMaxWidth}px</b></span>
            <input type="range" min="320" max="960" step="20" value={activeStyle.imageMaxWidth} onChange={(event) => updateStyle("imageMaxWidth", Number(event.target.value))} />
          </label>
          <label className="obs-range-field"><span>ขนาดข้อความ <b>{Math.round(Number(activeStyle.textScale) * 100)}%</b></span>
            <input type="range" min="0.75" max="1.5" step="0.05" value={activeStyle.textScale} onChange={(event) => updateStyle("textScale", Number(event.target.value))} />
          </label>
        </div>
        <div className="obs-template-actions">
          <button type="button" className="obs-secondary-button" onClick={resetStyle}>คืนค่าแนะนำ</button>
          <button type="button" className="obs-primary-button" disabled={isSavingOverlayStyle} onClick={saveDisplayProfiles}>
            {isSavingOverlayStyle ? "กำลังบันทึก…" : "บันทึกและอัปเดตจอ"}
          </button>
        </div>
      </div>

      {isConnected ? (
        <div className="obs-live-grid">
          <section className="obs-live-card obs-scenes-card">
            <div className="obs-section-heading compact"><div><span className="obs-section-kicker">ฉากที่กำลังใช้งาน</span><h3>เลือก Scene</h3></div></div>
            <div className="obs-scene-buttons">
              {scenes.length ? scenes.map((scene) => <button type="button" key={scene} className={currentScene === scene ? "is-active" : ""} onClick={() => handleSceneSwitch(scene)}>{currentScene === scene && <span>●</span>}{scene}</button>) : <p>ไม่พบ Scene ใน OBS</p>}
            </div>
          </section>

          <section className="obs-live-card">
            <div className="obs-section-heading compact"><div><span className="obs-section-kicker">ควบคุมด่วน</span><h3>เนื้อหาบนจอที่ใช้งาน</h3></div></div>
            <div className="obs-source-list">
              {SOURCE_LABELS.map(([source, label, icon]) => {
                const item = overlayItems[source];
                return <div className="obs-source-row" key={source}>
                  <span className="obs-source-icon">{icon}</span><div><strong>{label}</strong><small>{item?.enabled === false ? "ซ่อนอยู่" : "พร้อมแสดง"}</small></div>
                  <button type="button" className="obs-visibility-button" onClick={() => handleEmergencyHide(source, item?.enabled === false)}>{item?.enabled === false ? "แสดง" : "ซ่อน"}</button>
                </div>;
              })}
            </div>
          </section>

          <section className="obs-live-card">
            <div className="obs-section-heading compact"><div><span className="obs-section-kicker">ข้อความบนจอ</span><h3>ข้อความต้อนรับ</h3></div></div>
            <div className="obs-marquee-control"><input value={marqueeText} maxLength="160" onChange={(event) => setMarqueeText(event.target.value)} placeholder="พิมพ์ข้อความที่ต้องการขึ้นจอ" /><button type="button" className="obs-primary-button" onClick={() => handleMarqueeUpdate(marqueeText)}>แสดง</button><button type="button" className="obs-secondary-button" onClick={() => handleMarqueeUpdate("")}>ล้าง</button></div>
            <button type="button" className={`obs-audio-toggle ${bgmMuted ? "is-muted" : ""}`} onClick={handleToggleMute}>{bgmMuted ? "🔇 เปิดเสียง BGM" : "🔊 ปิดเสียง BGM"}</button>
          </section>
        </div>
      ) : (
        <div className="obs-setup-note"><strong>เริ่มต้นครั้งแรก:</strong> เปิด OBS → <b>เครื่องมือ → การตั้งค่า WebSocket Server</b> → เปิดใช้งาน Server → ใส่รหัสเดียวกับด้านบน แล้วกด “เชื่อมต่อ OBS” ระบบจะสร้าง Source ที่ต้องใช้ให้อัตโนมัติ</div>
      )}

      {isConnected && <details className="obs-advanced"><summary>ปรับตำแหน่ง Source แบบละเอียด (สำหรับทีมเทคนิค)</summary><p>ปกติไม่จำเป็นต้องใช้ เพราะรูปแบบภายในเนื้อหาบนจอปรับจากด้านบนแล้ว</p><div className="obs-canvas" ref={canvasRef} onMouseMove={handleCanvasMouseMove} onMouseUp={handleCanvasMouseUp} onMouseLeave={handleCanvasMouseUp}>{Object.entries(overlayItems).map(([sourceName, item]) => <button type="button" key={sourceName} className={`obs-overlay-pin${dragging === sourceName ? " dragging" : ""}${!item.enabled ? " hidden" : ""}`} style={{ left: `clamp(0%, ${(item.x / 1920) * 100}%, 84%)`, top: `clamp(0%, ${(item.y / 1080) * 100}%, 82%)` }} onMouseDown={(event) => handleCanvasMouseDown(event, sourceName)}>{sourceName}<small>{Math.round(item.x)}, {Math.round(item.y)}</small></button>)}</div></details>}

      {isConnected && <details className="obs-advanced obs-log-details"><summary>บันทึกการเชื่อมต่อ</summary><div className="obs-log-list">{logs.slice(-15).map((log, index) => <div key={`${log.time}-${index}`} className={`obs-log-line ${log.type}`}><time>{log.time}</time>{log.msg}</div>)}<div ref={logsEndRef} /></div></details>}
    </section>
  );
}
