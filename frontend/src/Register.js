import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Register.css";

function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    
    // Clear previous error message
    setErrorMessage("");

    // Validation
    if (!username.trim()) {
      setErrorMessage("กรุณากรอก Username");
      return;
    }
    if (!password) {
      setErrorMessage("กรุณากรอก Password");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:5001/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        // Success notification
        setUsername("");
        setPassword("");
        navigate("/home");
      } else {
        setErrorMessage(data.message || "Username หรือ Password ไม่ถูกต้อง");
      }
    } catch (error) {
      console.error("Error during login:", error);
      setErrorMessage("เกิดข้อผิดพลาดในการเข้าสู่ระบบ โปรดลองอีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleLogin(e);
    }
  };

  return (
    <div className="register-container">
      <h1>ADMIN LOGIN</h1>
      <p>ยินดีต้อนรับเข้าสู่ระบบบริหารจัดการ</p>
      <form className="register-form" onSubmit={handleLogin}>
        <div>
          <label htmlFor="username">👤 Username</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="กรอก Username ของคุณ"
            disabled={isLoading}
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="password">🔒 Password</label>
          <div className="password-container">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="กรอก Password ของคุณ"
              disabled={isLoading}
            />
            <span
              className="toggle-password-icon"
              onClick={() => setShowPassword(!showPassword)}
              title={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
            >
              {showPassword ? (
                <i className="fas fa-eye"></i>
              ) : (
                <i className="fas fa-eye-slash"></i>
              )}
            </span>
          </div>
        </div>

        {errorMessage && <p className="error-message">⚠️ {errorMessage}</p>}
        
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

export default Register;