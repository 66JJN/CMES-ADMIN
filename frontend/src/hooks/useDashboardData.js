import { useContext, useCallback, useState, useEffect, useRef } from 'react';
import { HomeContext } from '../contexts/HomeContext';
import { API_BASE_URL } from '../config/apiConfig';
import adminFetch from '../config/authFetch';

const DEFAULT_CARD_ORDER = ['feature', 'package', 'vip'];

/**
 * Custom hook to manage all HTTP dashboard data fetches, updates, and card layout reordering.
 */
export default function useDashboardData() {
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

  // ===== Card Reordering States =====
  const [cardOrder, setCardOrder] = useState(() => {
    try {
      const saved = localStorage.getItem('adminCardOrder');
      return saved ? JSON.parse(saved) : DEFAULT_CARD_ORDER;
    } catch { return DEFAULT_CARD_ORDER; }
  });

  const [cardVisibility, setCardVisibility] = useState(() => {
    try {
      const saved = localStorage.getItem('adminCardVisibility');
      return saved ? JSON.parse(saved) : { feature: true, package: true, vip: true };
    } catch { return { feature: true, package: true, vip: true }; }
  });

  const [draggedCard, setDraggedCard] = useState(null);
  const [dragOverCard, setDragOverCard] = useState(null);
  const dragNodeRef = useRef(null);

  // Persist order updates
  useEffect(() => {
    localStorage.setItem('adminCardOrder', JSON.stringify(cardOrder));
  }, [cardOrder]);

  // Persist visibility updates
  useEffect(() => {
    localStorage.setItem('adminCardVisibility', JSON.stringify(cardVisibility));
  }, [cardVisibility]);

  // ===== Drag & Drop Actions =====
  const handleDragStart = (e, cardId) => {
    setDraggedCard(cardId);
    dragNodeRef.current = e.currentTarget;
    e.dataTransfer.effectAllowed = 'move';
    
    // Smooth opacity ghost effect
    setTimeout(() => { 
      if (dragNodeRef.current) dragNodeRef.current.style.opacity = '0.4'; 
    }, 0);
  };

  const handleDragEnd = () => {
    if (dragNodeRef.current) dragNodeRef.current.style.opacity = '1';
    setDraggedCard(null);
    setDragOverCard(null);
    dragNodeRef.current = null;
  };

  const handleDragOver = (e, cardId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (cardId !== draggedCard) setDragOverCard(cardId);
  };

  const handleDrop = (e, targetCardId) => {
    e.preventDefault();
    if (!draggedCard || draggedCard === targetCardId) return;

    setCardOrder(prev => {
      const newOrder = [...prev];
      const fromIdx = newOrder.indexOf(draggedCard);
      const toIdx = newOrder.indexOf(targetCardId);
      newOrder.splice(fromIdx, 1);
      newOrder.splice(toIdx, 0, draggedCard);
      return newOrder;
    });

    setDraggedCard(null);
    setDragOverCard(null);
  };

  const toggleCardVisibility = (cardId) => {
    setCardVisibility(prev => ({ ...prev, [cardId]: !prev[cardId] }));
  };

  // ===== HTTP API Data Requests =====
  
  // loadTopRanks: fetch top rank users list
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
      console.error("[useDashboardData] loadTopRanks failed", error);
      setRankError("ไม่สามารถโหลดข้อมูลอันดับได้");
      if (!silent) setTopRanks([]);
    } finally {
      if (silent) setRefreshingRanks(false);
      else setRankLoading(false);
    }
  }, [rankingType, rankLimit, selectedDate, selectedMonth, selectedYear, setTopRanks, setTotalRankers, setRankLoading, setRefreshingRanks, setRankError]);

  // loadRankingSummary: fetch aggregate revenue data
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
      console.error("[useDashboardData] loadRankingSummary failed", error);
    }
  }, [rankingType, selectedDate, selectedMonth, selectedYear, setRankingSummary]);

  // loadBirthdayRequirement: fetch minimum birthday contribution limit
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
      console.error("[useDashboardData] loadBirthdayRequirement failed", error);
    }
  }, [setBirthdaySpendingRequirement]);

  // handleSaveBirthdayRequirement: save config to server
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
      console.error("[useDashboardData] Failed to save birthday requirement:", error);
      showToast("เกิดข้อผิดพลาดในการบันทึก", "error");
    }
  };

  return {
    cardOrder,
    cardVisibility,
    draggedCard,
    dragOverCard,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    toggleCardVisibility,
    loadTopRanks,
    loadRankingSummary,
    loadBirthdayRequirement,
    handleSaveBirthdayRequirement
  };
}
