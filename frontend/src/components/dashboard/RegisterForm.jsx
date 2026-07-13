import React from "react";
import "./RegisterForm.css";

/**
 * Presentational Form component for Admin Login.
 * Pure UI relying on props for state updates and actions.
 */
export default function RegisterForm({
  username,
  setUsername,
  password,
  setPassword,
  showPassword,
  toggleShowPassword,
  errorMessage,
  isLoading,
  handleLogin,
  handleKeyPress,
}) {
  return (
    <div className="register-container">
      <h1>ADMIN LOGIN</h1>
      <p>ยินดีต้อนรับเข้าสู่ระบบบริหารจัดการ</p>

      {/* ฟอร์มล็อกอิน */}
      <form className="register-form" onSubmit={handleLogin}>
        {/* ช่องกรอก Username */}
        <div>
          <label htmlFor="username">👤 Username</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="กรอก Username ของคุณ"
            disabled={isLoading}
            autoFocus
          />
        </div>

        {/* ช่องกรอก Password */}
        <div>
          <label htmlFor="password">🔒 Password</label>
          <div className="password-container">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="กรอก Password ของคุณ"
              disabled={isLoading}
            />
            {/* ไอคอนแสดง/ซ่อนรหัสผ่าน */}
            <span
              className="toggle-password-icon"
              onClick={toggleShowPassword}
              title={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
            >
              {showPassword ? (
                <i className="fas fa-eye-slash"></i>
              ) : (
                <i className="fas fa-eye"></i>
              )}
            </span>
          </div>
        </div>

        {/* แสดงข้อความแจ้งเตือนข้อผิดพลาด (ถ้ามี) */}
        {errorMessage && <p className="error-message">⚠️ {errorMessage}</p>}

        {/* ปุ่มเข้าสู่ระบบ */}
        <button type="submit" disabled={isLoading}>
          {isLoading ? (
            <span>
              <i className="fas fa-spinner fa-spin"></i> กำลังเข้าสู่ระบบ...
            </span>
          ) : (
            "เข้าสู่ระบบ"
          )}
        </button>
      </form>
    </div>
  );
}
