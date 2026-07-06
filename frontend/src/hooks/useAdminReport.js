import { useState, useEffect, useMemo, useCallback } from "react";
import { API_BASE_URL } from "../config/apiConfig";
import adminFetch from "../config/authFetch";

const API_BASE = API_BASE_URL;

const CATEGORY_META = {
  technical: { label: "ปัญหาทางเทคนิค", icon: "⚡" },
  display: { label: "ปัญหาการแสดงผล", icon: "🖼️" },
  payment: { label: "ปัญหาการเงิน", icon: "💰" },
  upload: { label: "ปัญหาอัปโหลด", icon: "📁" },
  account: { label: "บัญชีผู้ใช้", icon: "👤" },
  suggestion: { label: "ข้อเสนอแนะ", icon: "💡" },
  other: { label: "อื่นๆ", icon: "📝" }
};

export default function useAdminReport() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [activeReport, setActiveReport] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  // ===== Auto-clear error notification with timeout cleanup (prevent memory leaks) =====
  useEffect(() => {
    if (!error) return;
    const timeout = setTimeout(() => setError(""), 3000);
    return () => clearTimeout(timeout);
  }, [error]);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await adminFetch(`${API_BASE}/api/reports`);
      if (!res.ok) throw new Error("FAILED");
      const data = await res.json();
      const sorted = (data || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setReports(sorted);
    } catch (err) {
      console.error("โหลดรายงานไม่สำเร็จ", err);
      setError("ไม่สามารถโหลดรายการรายงานได้");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleStatusChange = useCallback(async (report, status) => {
    if (report.status === status) return;
    setUpdatingId(report.id);
    try {
      const res = await adminFetch(`${API_BASE}/api/reports/${report.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error("PATCH_FAILED");
      const data = await res.json();
      setReports((prev) => prev.map((item) => (item.id === data.report.id ? data.report : item)));
      if (activeReport && activeReport.id === data.report.id) {
        setActiveReport(data.report);
      }
    } catch (err) {
      console.error("อัปเดตสถานะไม่สำเร็จ", err);
      setError("ไม่สามารถอัปเดตสถานะได้");
    } finally {
      setUpdatingId(null);
    }
  }, [activeReport]);

  const formatDate = useCallback((date) => {
    if (!date) return "-";
    return new Date(date).toLocaleString("th-TH", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }, []);

  const filteredReports = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return reports.filter((report) => {
      const normalizedDetail = (report.detail || "").toLowerCase();
      const categoryLabel = (CATEGORY_META[report.category]?.label || report.category || "").toLowerCase();
      const matchStatus = filter === "all" ? report.status !== "resolved" : report.status === filter;
      const matchKeyword = !keyword || normalizedDetail.includes(keyword) || categoryLabel.includes(keyword);
      return matchStatus && matchKeyword;
    });
  }, [reports, filter, search]);

  const stats = useMemo(() => {
    const summary = { total: reports.length, new: 0, reading: 0, resolved: 0 };
    reports.forEach((r) => {
      summary[r.status] = (summary[r.status] || 0) + 1;
    });
    return summary;
  }, [reports]);

  const viewDescription = filter === "resolved" ? "แสดงเฉพาะงานที่ปิดไปแล้ว" : "แสดงเฉพาะงานที่ยังรอดำเนินการ";

  return {
    reports,
    loading,
    error,
    setError,
    filter,
    setFilter,
    search,
    setSearch,
    activeReport,
    setActiveReport,
    updatingId,
    loadReports,
    handleStatusChange,
    formatDate,
    filteredReports,
    stats,
    viewDescription
  };
}
