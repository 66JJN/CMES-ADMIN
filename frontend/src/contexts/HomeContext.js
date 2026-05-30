import React, { createContext, useState } from 'react';
import { getTodayStr, getCurrentMonthStr } from '../utils/dateHelpers';

export const HomeContext = createContext();

export function HomeProvider({ children, socket, shopId }) {
  // ===== System Config & Controls state =====
  const [systemOn, setSystemOn] = useState(true);
  const [enableImage, setEnableImage] = useState(true);
  const [enableText, setEnableText] = useState(true);
  const [enableGift, setEnableGift] = useState(true);
  const [enableBirthday, setEnableBirthday] = useState(true);
  const [birthdaySpendingRequirement, setBirthdaySpendingRequirement] = useState(100);

  // ===== Package controls state =====
  const [mode, setMode] = useState("image");
  const [minute, setMinute] = useState("");
  const [second, setSecond] = useState("");
  const [price, setPrice] = useState("");

  // ===== Rankings state =====
  const [topRanks, setTopRanks] = useState([]);
  const [totalRankers, setTotalRankers] = useState(0);
  const [rankLoading, setRankLoading] = useState(true);
  const [refreshingRanks, setRefreshingRanks] = useState(false);
  const [rankError, setRankError] = useState("");
  const [rankingType, setRankingType] = useState("alltime");
  const [rankLimit, setRankLimit] = useState(10);
  
  // ===== Date filter pickers state =====
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthStr());
  // ว่าง = อันดับตลอดกาลจาก Ranking หลัก (ไม่กรองปี); ระบุปี = ดึงจาก RankingHistory
  const [selectedYear, setSelectedYear] = useState('');
  const [rankingSummary, setRankingSummary] = useState({ totalSum: 0, totalUsers: 0 });
  const [publicRankingType, setPublicRankingType] = useState("alltime");

  // ===== Modal triggers state =====
  const [showIncomeStats, setShowIncomeStats] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [showObsModal, setShowObsModal] = useState(false);
  const [showPerksModal, setShowPerksModal] = useState(false);
  const [showAllRanks, setShowAllRanks] = useState(false);
  
  const [allRanks, setAllRanks] = useState([]);
  const [allRanksLoaded, setAllRanksLoaded] = useState(false);
  const [fetchingAllRanks, setFetchingAllRanks] = useState(false);
  const [allRankError, setAllRankError] = useState("");

  // ===== Profile, Perks & Payment QR state =====
  const [shopProfile, setShopProfile] = useState({ name: 'Admin', logo: null });
  const [perks, setPerks] = useState([]);
  const [editingPerkIndex, setEditingPerkIndex] = useState(null);
  const [perkInputValue, setPerkInputValue] = useState("");
  const [savingPerks, setSavingPerks] = useState(false);
  const [paymentQrUrl, setPaymentQrUrl] = useState(null);
  
  const [toastConfig, setToastConfig] = useState({ message: "", type: "success" });
  const showToast = (message, type = "success") => setToastConfig({ message, type });

  const value = {
    socket, shopId,
    systemOn, setSystemOn,
    enableImage, setEnableImage,
    enableText, setEnableText,
    enableGift, setEnableGift,
    enableBirthday, setEnableBirthday,
    birthdaySpendingRequirement, setBirthdaySpendingRequirement,
    mode, setMode,
    minute, setMinute,
    second, setSecond,
    price, setPrice,
    topRanks, setTopRanks,
    totalRankers, setTotalRankers,
    rankLoading, setRankLoading,
    refreshingRanks, setRefreshingRanks,
    rankError, setRankError,
    rankingType, setRankingType,
    rankLimit, setRankLimit,
    selectedDate, setSelectedDate,
    selectedMonth, setSelectedMonth,
    selectedYear, setSelectedYear,
    rankingSummary, setRankingSummary,
    publicRankingType, setPublicRankingType,
    showIncomeStats, setShowIncomeStats,
    showQrModal, setShowQrModal,
    qrCodeUrl, setQrCodeUrl,
    showObsModal, setShowObsModal,
    showPerksModal, setShowPerksModal,
    showAllRanks, setShowAllRanks,
    allRanks, setAllRanks,
    allRanksLoaded, setAllRanksLoaded,
    fetchingAllRanks, setFetchingAllRanks,
    allRankError, setAllRankError,
    shopProfile, setShopProfile,
    perks, setPerks,
    editingPerkIndex, setEditingPerkIndex,
    perkInputValue, setPerkInputValue,
    savingPerks, setSavingPerks,
    paymentQrUrl, setPaymentQrUrl,
    toastConfig, setToastConfig, showToast
  };

  return (
    <HomeContext.Provider value={value}>
      {children}
    </HomeContext.Provider>
  );
}
