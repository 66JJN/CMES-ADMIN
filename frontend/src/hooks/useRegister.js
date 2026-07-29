import { useState, useContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ShopContext } from "../contexts/ShopContext";
import { API_BASE_URL } from "../config/apiConfig";

/**
 * Custom Hook for handling Admin Login logic.
 * Manages form inputs, password visibility, double-submission lock,
 * multi-tenant shop context mapping, and browser storage persistence.
 */
export default function useRegister() {
  const [username, setUsernameState] = useState("");
  const [password, setPasswordState] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const { setShopId } = useContext(ShopContext);

  const setUsername = useCallback((val) => {
    setUsernameState(val);
    setErrorMessage(""); // clear errors when typing
  }, []);

  const setPassword = useCallback((val) => {
    setPasswordState(val);
    setErrorMessage(""); // clear errors when typing
  }, []);

  const toggleShowPassword = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  const handleLogin = useCallback(async (e) => {
    if (e) e.preventDefault();

    // Prevent double submission / concurrency issues
    if (isLoading) return;

    setErrorMessage("");

    // Input Validation
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
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (data.user && data.user.id && data.token) {
          localStorage.setItem("adminId", data.user.id);
          localStorage.setItem("adminUsername", data.user.username);
          localStorage.setItem("adminToken", data.token);

          if (data.user.shopId) {
            console.log(`[Login] Shop ID: ${data.user.shopId}`);
            localStorage.setItem("shopId", data.user.shopId);
            setShopId(data.user.shopId); // Set in context to start websocket connection
          } else {
            console.warn("[Login] ⚠️ No shopId in response");
            setErrorMessage("ไม่พบข้อมูล Shop ID กรุณาติดต่อผู้ดูแลระบบ");
            setIsLoading(false);
            return;
          }
        }

        // Reset form inputs
        setUsernameState("");
        setPasswordState("");
        
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
  }, [username, password, isLoading, navigate, setShopId]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === "Enter") {
      handleLogin(e);
    }
  }, [handleLogin]);

  return {
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
  };
}
