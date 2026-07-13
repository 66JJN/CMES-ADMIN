import { useState, useEffect, useRef, useContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ShopContext } from "../contexts/ShopContext";
import { API_BASE_URL } from "../config/apiConfig";
import adminFetch from "../config/authFetch";

/**
 * Custom Hook for managing the Edit Profile state and APIs.
 * Handles:
 * 1. Fetching shop metadata (logo, display name).
 * 2. File uploads (validation, previews, and garbage collection of Object URLs to avoid memory leaks).
 * 3. Text field updates (Shop Name, Shop ID).
 * 4. Password updates with matching validations.
 * 5. Logout and redirection flow.
 */
export default function useEditProfile() {
  const navigate = useNavigate();
  const { logout } = useContext(ShopContext);

  const [adminShopId, setAdminShopId] = useState(localStorage.getItem("shopId") || "");
  const [username] = useState(localStorage.getItem("adminUsername") || "Admin");

  // Logo upload state
  const [shopLogo, setShopLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoLoading, setLogoLoading] = useState(false);
  const logoInputRef = useRef(null);

  // Shop Display Name state
  const [shopDisplayName, setShopDisplayName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameLoading, setNameLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);

  // Shop ID state
  const [isEditingShopId, setIsEditingShopId] = useState(false);
  const [newShopIdInput, setNewShopIdInput] = useState(adminShopId);
  const [shopIdLoading, setShopIdLoading] = useState(false);

  // Password fields state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // Global Alert Message state
  const [message, setMessage] = useState({ text: "", type: "" });
  const [loading, setLoading] = useState(false);

  // Auto-hide alert message
  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => {
        setMessage({ text: "", type: "" });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Load current shop profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await adminFetch(`${API_BASE_URL}/api/shop/profile`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.shop) {
            setShopDisplayName(data.shop.name || adminShopId);
            setNameInput(data.shop.name || adminShopId);
            if (data.shop.logo) setLogoPreview(data.shop.logo);
          }
        }
      } catch (err) {
        console.warn("[EditProfile] Failed to load shop profile:", err.message);
      }
    };
    if (adminShopId) fetchProfile();
  }, [adminShopId]);

  // Close emoji picker on clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup blob URL to prevent memory leaks
  useEffect(() => {
    return () => {
      if (logoPreview && logoPreview.startsWith("blob:")) {
        console.log("[useEditProfile] Revoking preview URL:", logoPreview);
        URL.revokeObjectURL(logoPreview);
      }
    };
  }, [logoPreview]);

  // Logo upload functions
  const handleLogoClick = useCallback(() => {
    logoInputRef.current?.click();
  }, []);

  const handleLogoChange = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage({ text: "กรุณาเลือกไฟล์รูปภาพเท่านั้น", type: "error" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ text: "ไฟล์ต้องมีขนาดไม่เกิน 5MB", type: "error" });
      return;
    }

    // Revoke previous temp URL if any
    if (logoPreview && logoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(logoPreview);
    }

    setShopLogo(file);
    setLogoPreview(URL.createObjectURL(file));
  }, [logoPreview]);

  const handleCancelLogo = useCallback(() => {
    // Revoke temp blob URL
    if (logoPreview && logoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(logoPreview);
    }
    setShopLogo(null);
    setLogoPreview(null);
    
    // Re-fetch profile to restore original logo
    const fetchLogo = async () => {
      try {
        const res = await adminFetch(`${API_BASE_URL}/api/shop/profile`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.shop && data.shop.logo) {
            setLogoPreview(data.shop.logo);
          }
        }
      } catch (err) {
        console.warn("[EditProfile] Failed to restore logo:", err.message);
      }
    };
    fetchLogo();
  }, [logoPreview]);

  const handleLogoUpload = useCallback(async () => {
    if (!shopLogo) return;
    setLogoLoading(true);
    try {
      const formData = new FormData();
      formData.append("logo", shopLogo);
      const res = await adminFetch(`${API_BASE_URL}/api/shop/logo`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setLogoPreview(data.logo);
        setShopLogo(null);
        setMessage({ text: "อัปโหลดโลโก้ร้านสำเร็จ! 🎉", type: "success" });
      } else {
        setMessage({ text: data.message || "อัปโหลดล้มเหลว", type: "error" });
      }
    } catch (err) {
      setMessage({ text: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้", type: "error" });
    } finally {
      setLogoLoading(false);
    }
  }, [shopLogo]);

  // Shop Display Name functions
  const handleSaveName = useCallback(async () => {
    if (!nameInput.trim()) {
      setMessage({ text: "กรุณาระบุชื่อร้านค้า", type: "error" });
      return;
    }
    setNameLoading(true);
    try {
      const res = await adminFetch(`${API_BASE_URL}/api/shop/name`, {
        method: "POST",
        body: JSON.stringify({ name: nameInput.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setShopDisplayName(data.name);
        setIsEditingName(false);
        setShowEmojiPicker(false);
        setMessage({ text: "เปลี่ยนชื่อร้านสำเร็จ! ✨", type: "success" });
      } else {
        setMessage({ text: data.message || "เกิดข้อผิดพลาด", type: "error" });
      }
    } catch {
      setMessage({ text: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้", type: "error" });
    } finally {
      setNameLoading(false);
    }
  }, [nameInput]);

  const handleCancelEditName = useCallback(() => {
    setIsEditingName(false);
    setShowEmojiPicker(false);
    setNameInput(shopDisplayName);
  }, [shopDisplayName]);

  // Shop ID functions
  const handleSaveShopId = useCallback(async () => {
    if (!newShopIdInput.trim()) {
      setMessage({ text: "กรุณาระบุชื่อร้านค้า", type: "error" });
      return;
    }
    if (newShopIdInput.trim() === adminShopId) {
      setIsEditingShopId(false);
      return;
    }
    if (newShopIdInput.trim().length > 40) {
      setMessage({ text: "ชื่อร้านค้าต้องไม่เกิน 40 ตัวอักษร", type: "error" });
      return;
    }

    setShopIdLoading(true);
    try {
      const res = await adminFetch(`${API_BASE_URL}/api/admin/change-shopid`, {
        method: "POST",
        body: JSON.stringify({ newShopId: newShopIdInput }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("shopId", data.newShopId);
        setAdminShopId(data.newShopId);
        setIsEditingShopId(false);
        setMessage({ text: "เปลี่ยนชื่อร้านค้าสำเร็จ! (ระบบอาจรีเฟรชการเชื่อมต่อสักครู่)", type: "success" });
      } else {
        setMessage({ text: data.message || "เกิดข้อผิดพลาดในการเปลี่ยนชื่อร้านค้า", type: "error" });
      }
    } catch {
      setMessage({ text: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้", type: "error" });
    } finally {
      setShopIdLoading(false);
    }
  }, [newShopIdInput, adminShopId]);

  const handleCancelEditShopId = useCallback(() => {
    setNewShopIdInput(adminShopId);
    setIsEditingShopId(false);
  }, [adminShopId]);

  // Password Change function
  const handleChangePassword = useCallback(async (e) => {
    if (e) e.preventDefault();
    if (!currentPw || !newPw || !confirmPw) {
      setMessage({ text: "กรุณากรอกข้อมูลให้ครบถ้วน", type: "error" });
      return;
    }
    if (newPw !== confirmPw) {
      setMessage({ text: "รหัสผ่านใหม่และการยืนยันไม่ตรงกัน", type: "error" });
      return;
    }
    if (newPw.length < 6) {
      setMessage({ text: "รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร", type: "error" });
      return;
    }

    setLoading(true);
    try {
      const res = await adminFetch(`${API_BASE_URL}/api/admin/change-password`, {
        method: "POST",
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: "อัปเดตรหัสผ่านใหม่เรียบร้อยแล้ว", type: "success" });
        setCurrentPw("");
        setNewPw("");
        setConfirmPw("");
      } else {
        setMessage({ text: data.message || "เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน", type: "error" });
      }
    } catch {
      setMessage({ text: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ในขณะนี้", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [currentPw, newPw, confirmPw]);

  const handleLogout = useCallback(() => {
    logout();
    navigate("/");
  }, [logout, navigate]);

  return {
    adminShopId,
    username,
    shopLogo,
    logoPreview,
    logoLoading,
    logoInputRef,
    shopDisplayName,
    isEditingName,
    setIsEditingName,
    nameInput,
    setNameInput,
    nameLoading,
    showEmojiPicker,
    setShowEmojiPicker,
    emojiPickerRef,
    isEditingShopId,
    setIsEditingShopId,
    newShopIdInput,
    setNewShopIdInput,
    shopIdLoading,
    currentPw,
    setCurrentPw,
    newPw,
    setNewPw,
    confirmPw,
    setConfirmPw,
    showCurrentPw,
    setShowCurrentPw,
    showNewPw,
    setShowNewPw,
    showConfirmPw,
    setShowConfirmPw,
    message,
    setMessage,
    loading,
    handleLogoClick,
    handleLogoChange,
    handleCancelLogo,
    handleLogoUpload,
    handleSaveName,
    handleCancelEditName,
    handleSaveShopId,
    handleCancelEditShopId,
    handleChangePassword,
    handleLogout
  };
}
