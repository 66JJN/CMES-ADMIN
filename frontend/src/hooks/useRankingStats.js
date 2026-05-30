import { useContext, useCallback } from 'react';
import { HomeContext } from '../contexts/HomeContext';
import { API_BASE_URL } from '../config/apiConfig';
import adminFetch from '../config/authFetch';

/**
 * Custom hook to manage all rankings data fetching, statistics summaries, 
 * and configuration updates.
 */
export default function useRankingStats() {
  const {
    rankingType,
    rankLimit,
    selectedDate,
    selectedMonth,
    selectedYear,
    setTopRanks,
    setTotalRankers,
    setRankLoading,
    setRefreshingRanks,
    setRankError,
    setRankingSummary,
    birthdaySpendingRequirement,
    setBirthdaySpendingRequirement,
    showToast
  } = useContext(HomeContext);

  // ===== loadTopRanks: fetch top rank users list =====
  const loadTopRanks = useCallback(async (silent = false) => {
    if (silent) setRefreshingRanks(true);
    else setRankLoading(true);

    try {
      setRankError("");
      const params = new URLSearchParams({
        limit: String(rankLimit),
        type: rankingType
      });
      if (rankingType === "daily" && selectedDate) params.set("date", selectedDate);
      if (rankingType === "monthly" && selectedMonth) params.set("month", selectedMonth);
      if (rankingType === "alltime" && selectedYear) params.set("year", selectedYear);

      const res = await adminFetch(`${API_BASE_URL}/api/rankings?${params}`);
      if (!res.ok) throw new Error("FAILED");
      const data = await res.json();
      if (!data.success) throw new Error("FAILED");

      setTopRanks(data.ranks || []);
      setTotalRankers(data.total ?? data.totalUsers ?? (data.ranks?.length || 0));
    } catch (error) {
      console.error("[useRankingStats] loadTopRanks failed", error);
      setRankError("ไม่สามารถโหลดข้อมูลอันดับได้");
      if (!silent) setTopRanks([]);
    } finally {
      if (silent) setRefreshingRanks(false);
      else setRankLoading(false);
    }
  }, [rankingType, rankLimit, selectedDate, selectedMonth, selectedYear, setTopRanks, setTotalRankers, setRankLoading, setRefreshingRanks, setRankError]);

  // ===== loadRankingSummary: fetch aggregate revenue data =====
  const loadRankingSummary = useCallback(async () => {
    try {
      const params = new URLSearchParams({ type: rankingType });
      if (rankingType === "daily" && selectedDate) params.set("date", selectedDate);
      if (rankingType === "monthly" && selectedMonth) params.set("month", selectedMonth);
      if (rankingType === "alltime" && selectedYear) params.set("year", selectedYear);

      const res = await adminFetch(`${API_BASE_URL}/api/rankings/summary?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        setRankingSummary({ totalSum: data.totalSum || 0, totalUsers: data.totalUsers || 0 });
      }
    } catch (error) {
      console.error("[useRankingStats] loadRankingSummary failed", error);
    }
  }, [rankingType, selectedDate, selectedMonth, selectedYear, setRankingSummary]);

  // ===== loadBirthdayRequirement: fetch minimum birthday contribution limit =====
  const loadBirthdayRequirement = useCallback(async () => {
    try {
      const res = await adminFetch(`${API_BASE_URL}/api/config/birthday-requirement`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setBirthdaySpendingRequirement(data.birthdaySpendingRequirement || 100);
        }
      }
    } catch (error) {
      console.error("[useRankingStats] loadBirthdayRequirement failed", error);
    }
  }, [setBirthdaySpendingRequirement]);

  // ===== handleSaveBirthdayRequirement: save config to server =====
  const handleSaveBirthdayRequirement = async () => {
    const requirement = Number(birthdaySpendingRequirement);
    if (isNaN(requirement) || requirement < 0) {
      showToast("กรุณากรอกยอดเงินที่ถูกต้อง", "error");
      return;
    }

    try {
      const res = await adminFetch(`${API_BASE_URL}/api/config/birthday-requirement`, {
        method: "POST",
        body: JSON.stringify({ birthdaySpendingRequirement: requirement })
      });

      if (res.ok) {
        showToast("บันทึกยอดใช้จ่ายขั้นต่ำสำหรับวันเกิดสำเร็จ", "success");
      } else {
        showToast("เกิดข้อผิดพลาดในการบันทึก", "error");
      }
    } catch (error) {
      console.error("[useRankingStats] Failed to save birthday requirement:", error);
      showToast("เกิดข้อผิดพลาดในการบันทึก", "error");
    }
  };

  return {
    loadTopRanks,
    loadRankingSummary,
    loadBirthdayRequirement,
    handleSaveBirthdayRequirement
  };
}
