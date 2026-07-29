/**
 * authFetch.js — Admin shared fetch utility
 * - อัตโนมัติเพิ่ม Bearer JWT ทุก request
 * - รองรับ FormData (ไม่บังคับ Content-Type)
 * - Redirect กลับหน้า login เมื่อได้รับ 401 Unauthorized
 */

export const handleAdminUnauthorized = () => {
  console.warn("[Admin] 401 Unauthorized — session expired, redirecting to login");
  localStorage.removeItem("adminId");
  localStorage.removeItem("adminUsername");
  localStorage.removeItem("shopId");
  localStorage.removeItem("adminToken");
  window.location.href = "/";
};

const adminFetch = async (url, options = {}) => {
  const token = localStorage.getItem("adminToken") || "";
  const isFormData = options.body instanceof FormData;

  const response = await fetch(url, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (response.status === 401) {
    handleAdminUnauthorized();
  }

  return response;
};

export default adminFetch;
