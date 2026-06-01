import React, { useContext } from 'react';
import { HomeContext } from '../../contexts/HomeContext';
import Card from '../ui/Card';
import Switch from '../ui/Switch';
import Button from '../ui/Button';
import useSocket from '../../hooks/useSocket';
import useDashboardData from '../../hooks/useDashboardData';
import './FeatureSwitches.css';

/**
 * FeatureSwitches dashboard component.
 * Displays toggleable system features (Image uploads, text posts, gift sends, birthday animations)
 * and controls spend threshold values. Consumes shared contexts and custom socket hooks cleanly.
 */
export default function FeatureSwitches({ 
  isCollapsed, 
  onToggleVisibility 
}) {
  const {
    systemOn,
    enableImage,
    enableText,
    enableGift,
    enableBirthday,
    birthdaySpendingRequirement,
    setBirthdaySpendingRequirement
  } = useContext(HomeContext);

  const {
    handleToggleSystem,
    handleToggleImage,
    handleToggleText,
    handleToggleGift,
    handleToggleBirthday
  } = useSocket();

  const {
    handleSaveBirthdayRequirement
  } = useDashboardData();

  return (
    <Card 
      type="panel" 
      className={`feature-card ${isCollapsed ? 'card-collapsed' : ''}`}
    >
      <div className="card-drag-handle" title="กดค้างแล้วลากเพื่อย้ายตำแหน่ง">
        <span className="drag-icon">⠿</span>
        <h3 className="card-drag-title">ฟังก์ชันต่างๆ</h3>
        <button 
          className="card-eye-btn" 
          onClick={(e) => { e.stopPropagation(); onToggleVisibility(); }} 
          title={isCollapsed ? 'แสดง' : 'ซ่อน'}
        >
          {isCollapsed ? '👁‍🗨' : '👁'}
        </button>
      </div>

      {!isCollapsed && (
        <div className="function-toggle-column">
          <div
            className={`system-master-control ${systemOn ? 'is-on' : 'is-off'}`}
            role="group"
            aria-label="สถานะระบบ"
          >
            <div className="system-master-text">
              <span className="system-master-title">สถานะระบบ</span>
              <span className="system-master-hint">เปิด–ปิดการใช้งานทั้งหมดของลูกค้า</span>
            </div>
            <Switch checked={systemOn} onChange={handleToggleSystem} />
          </div>

          {!systemOn && (
            <div className="system-off-msg-minimal" role="status">
              ระบบถูกปิด ฝั่งผู้ใช้จะไม่สามารถใช้งานได้
            </div>
          )}

          <div className="feature-sub-toggles">
          <div className="toggle-card">
            <span>ฟังก์ชันส่งรูปภาพ</span>
            <Switch 
              checked={enableImage} 
              onChange={handleToggleImage} 
              disabled={!systemOn} 
            />
          </div>

          <div className="toggle-card">
            <span>ฟังก์ชันข้อความ</span>
            <Switch 
              checked={enableText} 
              onChange={handleToggleText} 
              disabled={!systemOn} 
            />
          </div>

          <div className="toggle-card">
            <span>ฟังก์ชันส่งของขวัญ</span>
            <Switch 
              checked={enableGift} 
              onChange={handleToggleGift} 
              disabled={!systemOn} 
            />
          </div>

          <div className="toggle-card">
            <span>ฟังก์ชันอวยพรวันเกิด</span>
            <Switch 
              checked={enableBirthday} 
              onChange={handleToggleBirthday} 
              disabled={!systemOn} 
            />
          </div>

          <div className="toggle-card toggle-card-vertical">
            <span>ยอดใช้จ่ายขั้นต่ำสำหรับวันเกิด (บาท)</span>
            <div className="spend-requirement-row">
              <input
                type="number"
                min="0"
                placeholder="ยอดเงิน"
                value={birthdaySpendingRequirement}
                onChange={(e) => setBirthdaySpendingRequirement(e.target.value)}
                disabled={!systemOn}
                className="input-minimal input-spend-limit"
              />
              <Button
                onClick={handleSaveBirthdayRequirement}
                disabled={!systemOn}
                className="btn-spend-save"
              >
                บันทึก
              </Button>
            </div>
            <small className="spend-requirement-hint">
              ผู้ใช้ต้องใช้จ่ายครบจำนวนนี้ก่อนจึงจะใช้ฟีเจอร์วันเกิดฟรีได้
            </small>
          </div>
          </div>
        </div>
      )}
    </Card>
  );
}
