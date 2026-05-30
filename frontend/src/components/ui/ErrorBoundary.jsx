import React from 'react';
import '../dashboard/DashboardShared.css';

/**
 * Reusable ErrorBoundary to intercept chunk/module network loading failures
 * and present a clean recovery interface to the user.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught chunk error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="system-off-msg error-boundary-fallback">
          <h3>⚠️ เกิดข้อผิดพลาดในการโหลดมอดูล</h3>
          <p>ไม่สามารถโหลดหน้าต่างนี้ได้ชั่วคราว กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่อีกครั้ง</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mode-btn-minimal error-boundary-retry-btn" 
          >
            🔄 รีโหลดหน้าเว็บ
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
