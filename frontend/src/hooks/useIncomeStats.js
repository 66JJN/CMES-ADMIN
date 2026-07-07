import { useState, useEffect, useCallback } from "react";
import { API_BASE_URL } from "../config/apiConfig";
import adminFetch from "../config/authFetch";
import { getTodayStr } from "../utils/dateHelpers";

const formatDateStr = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const calculateDatesForPreset = (preset) => {
  const todayStr = getTodayStr();
  const [year, month, day] = todayStr.split("-").map(Number);
  
  const end = new Date(year, month - 1, day);
  let start = new Date(year, month - 1, day);

  if (preset === "today") {
    // start matches end
  } else if (preset === "this_week") {
    const dayOfWeek = end.getDay();
    const diff = end.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Starts Monday
    start = new Date(year, month - 1, diff);
  } else if (preset === "this_month") {
    start = new Date(year, month - 1, 1);
  } else if (preset === "this_year") {
    start = new Date(year, 0, 1);
  } else if (preset === "all_time") {
    start = new Date(year - 5, 0, 1);
  } else {
    return null;
  }

  return {
    startDate: formatDateStr(start),
    endDate: formatDateStr(end)
  };
};

export default function useIncomeStats(show, socket) {
  const getInitialDates = () => {
    try {
      const saved = localStorage.getItem('adminIncomeStats');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.activePreset === '30_days' || parsed.activePreset === '7_days') {
          parsed.activePreset = 'this_week';
        }
        if (parsed.activePreset && parsed.activePreset !== 'custom') {
          const recalculated = calculateDatesForPreset(parsed.activePreset);
          if (recalculated) {
            return {
              startDate: recalculated.startDate,
              endDate: recalculated.endDate,
              activePreset: parsed.activePreset
            };
          }
        }
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse adminIncomeStats from localStorage');
    }
    const calculated = calculateDatesForPreset('this_week');
    return {
      startDate: calculated.startDate,
      endDate: calculated.endDate,
      activePreset: 'this_week'
    };
  };

  const initial = getInitialDates();
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [activePreset, setActivePreset] = useState(initial.activePreset || '');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Persist to localStorage when dates change
  useEffect(() => {
    localStorage.setItem('adminIncomeStats', JSON.stringify({ startDate, endDate, activePreset }));
  }, [startDate, endDate, activePreset]);

  // Auto-clear error timeout with cleanup to prevent memory leaks
  useEffect(() => {
    if (!error) return;
    const timeout = setTimeout(() => setError(""), 3000);
    return () => clearTimeout(timeout);
  }, [error]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await adminFetch(
        `${API_BASE_URL}/api/admin/income-stats?startDate=${startDate}&endDate=${endDate}&_t=${Date.now()}`
      );
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      } else {
        setError(data.message || "ไม่สามารถโหลดข้อมูลได้");
      }
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  // Fetch stats when modal opens or date range changes
  useEffect(() => {
    if (show) {
      setStats(null);
      fetchStats();
    }
  }, [show, startDate, endDate, fetchStats]);

  // Real-time socket listeners
  useEffect(() => {
    if (!socket || !show) return;
    const handleUpdate = () => {
      fetchStats();
    };
    socket.on("admin-update-queue", handleUpdate);
    socket.on("ranking-update", handleUpdate);
    return () => {
      socket.off("admin-update-queue", handleUpdate);
      socket.off("ranking-update", handleUpdate);
    };
  }, [socket, show, fetchStats]);

  const handlePreset = (type) => {
    if (type === 'custom') {
      setActivePreset('custom');
      return;
    }
    const calculated = calculateDatesForPreset(type);
    if (calculated) {
      setStartDate(calculated.startDate);
      setEndDate(calculated.endDate);
      setActivePreset(type);
    }
  };

  const handleCustomDateChange = (isStart, value) => {
    setActivePreset('custom');
    if (isStart) setStartDate(value);
    else setEndDate(value);
  };

  const isEmpty = stats && stats.totalOrders === 0 && stats.totalIncome === 0;

  return {
    startDate,
    endDate,
    activePreset,
    stats,
    loading,
    error,
    isEmpty,
    handlePreset,
    handleCustomDateChange,
    fetchStats
  };
}
