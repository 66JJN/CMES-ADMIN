import React, { useState } from 'react';
import './OBSTestCard.css';

const STEP_LABELS = {
  image: 'รูปภาพและข้อความแนบ',
  text: 'ข้อความล้วน',
  gift: 'ของขวัญ',
};

export default function OBSTestCard({
  obsTest = {},
  isObsTestBusy = false,
  startObsTest = () => {},
  stopObsTest = () => {},
}) {
  const [confirmingStop, setConfirmingStop] = useState(false);
  const cleanupFailed = obsTest.code === 'TEST_CLEANUP_FAILED';
  const running = obsTest.active === true;
  const currentLabel = STEP_LABELS[obsTest.currentStep] || 'กำลังเตรียมข้อมูล';
  const blockedByQueue = obsTest.code === 'QUEUE_NOT_EMPTY';
  const displayDisconnected = obsTest.code === 'OBS_NOT_CONNECTED';

  const statusClass = cleanupFailed
    ? 'is-danger'
    : running
      ? 'is-running'
      : obsTest.ready
        ? 'is-ready'
        : 'is-blocked';

  return (
    <section className={`obs-test-card ${statusClass}`} aria-labelledby="obs-test-title">
      <div className="obs-test-card__header">
        <div className="obs-test-card__icon" aria-hidden="true">◉</div>
        <div>
          <span className="obs-section-kicker">ตรวจการแสดงผลก่อนเปิดใช้งาน</span>
          <h3 id="obs-test-title">ทดสอบการแสดงผล OBS</h3>
          <p>เล่นตัวอย่างรูปภาพ ข้อความ และของขวัญตามลำดับผ่านคิวจริง โดยไม่สร้างยอดหรือประวัติลูกค้า</p>
        </div>
      </div>

      {cleanupFailed ? (
        <div className="obs-test-card__message is-danger" role="alert">
          <strong>ล้างข้อมูลทดสอบยังไม่สำเร็จ</strong>
          <span>{obsTest.message || 'ระบบยังปิดรับคิวอยู่ เพื่อป้องกันข้อมูลจริงปะปน'}</span>
          <button type="button" disabled={isObsTestBusy} onClick={() => stopObsTest(obsTest.sessionId)}>
            {isObsTestBusy ? 'กำลังล้างข้อมูล…' : 'ลองล้างข้อมูลอีกครั้ง'}
          </button>
        </div>
      ) : running ? (
        <div className="obs-test-card__running">
          <div className="obs-test-progress" aria-label={`ขั้นที่ ${obsTest.stepNumber || 1} จาก ${obsTest.totalSteps || 3}`}>
            {['image', 'text', 'gift'].map((step, index) => {
              const number = index + 1;
              const active = step === obsTest.currentStep;
              const complete = number < (obsTest.stepNumber || 1);
              return <span key={step} className={`${active ? 'is-active' : ''} ${complete ? 'is-complete' : ''}`}>{number}</span>;
            })}
          </div>
          <strong>กำลังทดสอบ {obsTest.stepNumber || 1}/{obsTest.totalSteps || 3}: {currentLabel}</strong>
          <small>ระหว่างทดสอบ ระบบจะปิดรับรายการใหม่ชั่วคราวและเปิดคืนตามค่าเดิมเมื่อจบ</small>
          <button type="button" className="obs-test-stop" disabled={isObsTestBusy} onClick={() => setConfirmingStop(true)}>
            หยุดทดสอบและล้างข้อมูล
          </button>
        </div>
      ) : (
        <div className="obs-test-card__readiness">
          <div>
            <span className="obs-test-status-dot" />
            <strong>{obsTest.ready ? 'พร้อมทดสอบ' : blockedByQueue ? 'กรุณารอให้คิวว่างก่อน' : displayDisconnected ? 'OBS ยังไม่เชื่อมต่อ' : obsTest.message || 'กำลังตรวจสอบความพร้อม'}</strong>
            {blockedByQueue && <small>มี {obsTest.activeQueueCount || 0} รายการที่ต้องแสดงให้เสร็จก่อน</small>}
            {displayDisconnected && <small>เปิดหรือรีเฟรช Browser Source ภาพและข้อความใน OBS ก่อน</small>}
            {!blockedByQueue && !displayDisconnected && obsTest.ready && <small>แต่ละรายการแสดง 15 วินาที ใช้เวลารวมประมาณ 47 วินาที</small>}
          </div>
          <button type="button" disabled={!obsTest.ready || isObsTestBusy} onClick={startObsTest}>
            {isObsTestBusy ? 'กำลังเริ่มทดสอบ…' : 'เริ่มทดสอบ OBS'}
          </button>
        </div>
      )}

      {confirmingStop && (
        <div className="obs-test-confirm" role="alertdialog" aria-modal="true" aria-labelledby="obs-test-confirm-title">
          <div>
            <strong id="obs-test-confirm-title">หยุดการทดสอบตอนนี้?</strong>
            <p>รายการจำลองที่กำลังเล่นและที่รออยู่จะถูกลบ แต่จะไม่กระทบคิวของลูกค้า</p>
            <div>
              <button type="button" className="obs-secondary-button" onClick={() => setConfirmingStop(false)}>ยกเลิก</button>
              <button type="button" className="obs-test-stop" onClick={() => { setConfirmingStop(false); stopObsTest(obsTest.sessionId); }}>ยืนยันหยุดทดสอบ</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
