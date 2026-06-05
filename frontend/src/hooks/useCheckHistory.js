import { useState, useEffect, useCallback, useContext } from "react";
import { API_BASE_URL } from "../config/apiConfig";
import adminFetch from "../config/authFetch";
import { ShopContext } from "../contexts/ShopContext";

const ITEMS_PER_PAGE = 50;

// ── Timezone-Safe Date Helpers ──
const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getThisMonthRange = () => {
  const now = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
};

const getThisYearRange = () => {
  const now = new Date();
  const start = `${now.getFullYear()}-01-01`;
  const end = `${now.getFullYear()}-12-31`;
  return { start, end };
};

export default function useCheckHistory() {
  const { shopId } = useContext(ShopContext);

  // ── State ──
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // ── Filters & Session Persistence ──
  const [presetFilter, setPresetFilter] = useState(() => {
    return localStorage.getItem("ch-filter-preset") || null;
  });

  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [startDate, setStartDate] = useState(() => {
    const savedPreset = localStorage.getItem("ch-filter-preset");
    if (savedPreset === "today") return localStorage.getItem("ch-start-date") || getLocalDateString();
    if (savedPreset === "month") return getThisMonthRange().start;
    if (savedPreset === "year") return getThisYearRange().start;
    if (savedPreset === "custom") return localStorage.getItem("ch-start-date") || "";
    return ""; // null means first-time visit: fetch empty initially to determine the latest day's history
  });

  const [endDate, setEndDate] = useState(() => {
    const savedPreset = localStorage.getItem("ch-filter-preset");
    if (savedPreset === "today") return localStorage.getItem("ch-end-date") || getLocalDateString();
    if (savedPreset === "month") return getThisMonthRange().end;
    if (savedPreset === "year") return getThisYearRange().end;
    if (savedPreset === "custom") return localStorage.getItem("ch-end-date") || "";
    return ""; // null means first-time visit: fetch empty initially to determine the latest day's history
  });

  // ── Pagination ──
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  // ── Summary ──
  const [summary, setSummary] = useState({ total: 0, totalRevenue: 0, byType: {}, completed: 0, rejected: 0 });

  // ── Fetch ──
  const fetchHistory = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      let url = `${API_BASE_URL}/api/check-history?page=${page}&limit=${ITEMS_PER_PAGE}`;
      if (typeFilter !== "all") url += `&type=${typeFilter}`;
      if (searchQuery.trim()) url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;

      const res = await adminFetch(url);
      const json = await res.json();

      if (json.success) {
        setHistory(json.data || []);
        setPagination(json.pagination || { total: 0, totalPages: 1 });
        setSummary(json.summary || { total: 0, totalRevenue: 0, byType: {}, completed: 0, rejected: 0 });
      } else {
        // Fallback: old API format (array directly)
        if (Array.isArray(json)) {
          setHistory(json);
        }
      }
    } catch (err) {
      console.error("[CheckHistory] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [shopId, page, typeFilter, searchQuery, startDate, endDate]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [typeFilter, searchQuery, startDate, endDate]);

  // ── First-time visit auto-detection ──
  useEffect(() => {
    if (presetFilter === null && !loading) {
      if (history.length > 0) {
        // Find the date of the latest item (history is already sorted by approvalDate/createdAt desc)
        const latestItem = history[0];
        const latestDateStr = latestItem.checkedAt || latestItem.createdAt;
        if (latestDateStr) {
          const latestDate = new Date(latestDateStr);
          const dateStr = getLocalDateString(latestDate);
          
          setStartDate(dateStr);
          setEndDate(dateStr);
          setPresetFilter("today");
          localStorage.setItem("ch-filter-preset", "today");
          localStorage.setItem("ch-start-date", dateStr);
          localStorage.setItem("ch-end-date", dateStr);
        }
      } else {
        // No history at all, fallback to today's date
        const todayStr = getLocalDateString();
        setStartDate(todayStr);
        setEndDate(todayStr);
        setPresetFilter("today");
        localStorage.setItem("ch-filter-preset", "today");
        localStorage.setItem("ch-start-date", todayStr);
        localStorage.setItem("ch-end-date", todayStr);
      }
    }
  }, [presetFilter, loading, history]);

  const handleApplyPreset = useCallback((preset) => {
    let start = "";
    let end = "";
    const todayStr = getLocalDateString();
    
    if (preset === "today") {
      start = todayStr;
      end = todayStr;
    } else if (preset === "month") {
      const range = getThisMonthRange();
      start = range.start;
      end = range.end;
    } else if (preset === "year") {
      const range = getThisYearRange();
      start = range.start;
      end = range.end;
    }
    
    setStartDate(start);
    setEndDate(end);
    setPresetFilter(preset);
    localStorage.setItem("ch-filter-preset", preset);
    localStorage.setItem("ch-start-date", start);
    localStorage.setItem("ch-end-date", end);
  }, []);

  // ── Delete handlers ──
  const handleDelete = useCallback(async (id) => {
    if (!window.confirm("ยืนยันการลบรายการนี้?")) return;
    try {
      await adminFetch(`${API_BASE_URL}/api/delete-history`, {
        method: "POST",
        body: JSON.stringify({ id }),
      });
      fetchHistory();
    } catch (err) {
      console.error("[CheckHistory] Delete error:", err);
    }
  }, [fetchHistory]);

  const handleDeleteAll = useCallback(async () => {
    if (!window.confirm("ยืนยันการลบประวัติทั้งหมด?")) return;
    try {
      await adminFetch(`${API_BASE_URL}/api/delete-all-history`, {
        method: "POST"
      });
      fetchHistory();
    } catch (err) {
      console.error("[CheckHistory] Delete all error:", err);
    }
  }, [fetchHistory]);

  const getImageUrl = useCallback((filePath) => {
    if (!filePath) return null;
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
    return `${API_BASE_URL}${filePath.startsWith('/') ? filePath : `/${filePath}`}`;
  }, []);

  return {
    shopId,
    history,
    loading,
    selected,
    setSelected,
    showModal,
    setShowModal,
    editMode,
    setEditMode,
    presetFilter,
    setPresetFilter,
    typeFilter,
    setTypeFilter,
    searchQuery,
    setSearchQuery,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    page,
    setPage,
    pagination,
    summary,
    fetchHistory,
    handleApplyPreset,
    handleDelete,
    handleDeleteAll,
    getLocalDateString,
    getImageUrl,
  };
}
