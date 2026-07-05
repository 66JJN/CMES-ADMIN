import { useState, useEffect, useRef } from "react";
import { API_BASE_URL } from "../config/apiConfig";
import adminFetch from "../config/authFetch";

const API_BASE = API_BASE_URL;

export default function useGiftManagement() {
  const [items, setItems] = useState([]);
  const [tableCount, setTableCount] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ name: "", price: "", description: "" });
  const [localImage, setLocalImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const fileInputRef = useRef(null);

  const resolveImageSrc = (url) => {
    if (!url) return "";
    return url.startsWith("http") ? url : `${API_BASE}${url}`;
  };

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Clear alert message automatically after 3 seconds
  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => setMessage(""), 3000);
    return () => clearTimeout(timeout);
  }, [message]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await adminFetch(`${API_BASE}/api/gifts/settings`);
      const data = await response.json();
      setItems(data.items || []);
      setTableCount(data.tableCount || 10);
    } catch (error) {
      console.error("Load gift settings failed", error);
      setMessage("ไม่สามารถโหลดข้อมูลสินค้าได้");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddItem = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!form.name || form.price === "") {
      setMessage("กรุณากรอกชื่อและราคา (ใส่ 0 สำหรับแจกฟรี)");
      return;
    }
    if (Number(form.price) < 0) {
      setMessage("ราคาต้องไม่ติดลบ");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      let imageUrlToSave = "";
      if (localImage) {
        const uploadForm = new FormData();
        uploadForm.append("image", localImage);
        const uploadResponse = await adminFetch(`${API_BASE}/api/gifts/upload`, {
          method: "POST",
          body: uploadForm,
        });
        const uploadData = await uploadResponse.json();
        if (!uploadResponse.ok || !uploadData.success) {
          throw new Error(uploadData.message || "อัปโหลดรูปภาพไม่สำเร็จ");
        }
        imageUrlToSave = uploadData.url || "";
      }
      const response = await adminFetch(`${API_BASE}/api/gifts/items`, {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          price: Number(form.price),
          description: form.description,
          imageUrl: imageUrlToSave || "",
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "เพิ่มสินค้าล้มเหลว");
      }
      if (data.settings && data.settings.items) {
        setItems(data.settings.items);
      }
      setForm({ name: "", price: "", description: "" });
      setLocalImage(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setMessage("เพิ่มสินค้าสำเร็จ");
    } catch (error) {
      console.error("Add gift item failed", error);
      setMessage(error.message || "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("ต้องการลบสินค้ารายการนี้หรือไม่?")) return;
    try {
      const response = await adminFetch(`${API_BASE}/api/gifts/items/${id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "ลบไม่สำเร็จ");
      }
      if (data.settings && data.settings.items) {
        setItems(data.settings.items);
      }
    } catch (error) {
      console.error("Delete gift item failed", error);
      setMessage(error.message || "เกิดข้อผิดพลาด");
    }
  };

  const handleTableUpdate = async () => {
    if (!tableCount || Number(tableCount) < 1) {
      setMessage("จำนวนโต๊ะต้องมากกว่า 0");
      return;
    }
    try {
      const response = await adminFetch(`${API_BASE}/api/gifts/table-count`, {
        method: "PATCH",
        body: JSON.stringify({ tableCount: Number(tableCount) })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "บันทึกไม่สำเร็จ");
      }
      if (data.settings) {
        setItems(data.settings.items || []);
        setTableCount(data.settings.tableCount || tableCount);
      } else if (data.tableCount !== undefined) {
        setTableCount(data.tableCount);
      }
      setMessage("อัปเดตจำนวนโต๊ะเรียบร้อย");
    } catch (error) {
      console.error("Update table count failed", error);
      setMessage(error.message || "เกิดข้อผิดพลาด");
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setLocalImage(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setLocalImage(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const clearLocalImage = () => {
    setLocalImage(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return {
    items,
    tableCount,
    setTableCount,
    loading,
    saving,
    message,
    form,
    previewUrl,
    fileInputRef,
    loadSettings,
    resolveImageSrc,
    handleInputChange,
    handleAddItem,
    handleDelete,
    handleTableUpdate,
    handleFileChange,
    clearLocalImage
  };
}
