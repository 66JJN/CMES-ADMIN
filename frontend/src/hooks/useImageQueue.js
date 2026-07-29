import { useState, useEffect, useCallback, useContext, useRef } from "react";
import { API_BASE_URL } from "../config/apiConfig";
import adminFetch from "../config/authFetch";
import { ShopContext } from "../contexts/ShopContext";

export default function useImageQueue() {
  const { socket, shopId, isSocketConnected } = useContext(ShopContext);

  // ===== State Management: ข้อมูลรูปภาพและ UI =====
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [giftSettings, setGiftSettings] = useState([]);

  // ===== State: แก้ไขขนาดรูปภาพ =====
  const [editWidth, setEditWidth] = useState("");
  const [editHeight, setEditHeight] = useState("");

  // ===== State: แก้ไขรายการสินค้า Gift =====
  const [editGiftItems, setEditGiftItems] = useState([]);
  const [isEditingGift, setIsEditingGift] = useState(false);
  const [showAddGiftItem, setShowAddGiftItem] = useState(false);
  const [savingGiftItems, setSavingGiftItems] = useState(false);

  // ===== State: ระบบ Preview และ Queue =====
  const [currentPreview, setCurrentPreview] = useState(null);
  const [previewQueue, setPreviewQueue] = useState([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pauseTimeLeft, setPauseTimeLeft] = useState(0);
  const [queueControl, setQueueControl] = useState({ queuePaused: false, queueLastError: null });

  // Refs
  const isCompletingRef = useRef(false);
  const completedIdsRef = useRef(new Set());
  const previewQueueRef = useRef(previewQueue);
  const currentPreviewRef = useRef(currentPreview);
  const queueControlRef = useRef(queueControl);

  // Sync refs to avoid stale closures
  useEffect(() => {
    previewQueueRef.current = previewQueue;
  }, [previewQueue]);

  useEffect(() => {
    currentPreviewRef.current = currentPreview;
  }, [currentPreview]);

  useEffect(() => {
    queueControlRef.current = queueControl;
  }, [queueControl]);

  // ===== ฟังก์ชัน Helper: สร้าง URL ของรูปภาพอย่างปลอดภัย =====
  const getImageUrl = useCallback((filePath, baseUrl = API_BASE_URL) => {
    if (!filePath) return null;
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return filePath;
    }
    const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
    return `${baseUrl}${normalizedPath}`;
  }, []);

  // ===== ฟังก์ชัน: ดึงข้อมูลคิวรูปภาพจาก Server =====
  const fetchImages = useCallback(async () => {
    try {
      const response = await adminFetch(`${API_BASE_URL}/api/queue`);
      if (response.ok) {
        const data = await response.json();
        setImages(data);

        const playingOnServer = data.find(img => img.status === 'playing');

        if (playingOnServer && (!currentPreviewRef.current || (currentPreviewRef.current._id || currentPreviewRef.current.id) === (playingOnServer._id || playingOnServer.id))) {
          const duration = playingOnServer.time || 10;
          let remaining = duration;

          if (playingOnServer.playingAt) {
            const elapsed = (Date.now() - new Date(playingOnServer.playingAt).getTime()) / 1000;
            remaining = Math.max(0, duration - elapsed);
          }

          const control = queueControlRef.current;
          if (control.queuePaused) {
            setCurrentPreview(playingOnServer);
            setIsActive(false);
            setIsPaused(true);
            setPauseTimeLeft(0);
            setTimeLeft(Math.max(0, Number(control.queuePausedRemainingSeconds ?? remaining)));
          } else if (!isActive || !currentPreviewRef.current) {
            setIsPaused(false);
            setPauseTimeLeft(0);
            setCurrentPreview(playingOnServer);
            setIsActive(true);
            setTimeLeft(remaining);

            localStorage.setItem("currentPreview", JSON.stringify(playingOnServer));
            localStorage.setItem("isActive", "true");
            localStorage.setItem("startTimestamp", String(Date.now() - ((duration - remaining) * 1000)));
            localStorage.setItem("duration", String(duration));
          }
        } else if (!playingOnServer && currentPreviewRef.current) {
          setCurrentPreview(null);
          setIsActive(false);
          setTimeLeft(0);
          isCompletingRef.current = false;
          localStorage.removeItem("currentPreview");
          localStorage.removeItem("isActive");
          localStorage.removeItem("startTimestamp");
          localStorage.removeItem("duration");
        }
      }
    } catch (error) {
      console.error("Error fetching images:", error);
    } finally {
      setLoading(false);
    }
  }, [isActive]);

  const fetchQueueControl = useCallback(async () => {
    const response = await adminFetch(`${API_BASE_URL}/api/queue/control`);
    if (response.ok) {
      const data = await response.json();
      setQueueControl(data.control);
    }
  }, []);

  const setPlaybackPaused = useCallback(async (paused) => {
    const response = await adminFetch(`${API_BASE_URL}/api/queue/${paused ? 'pause' : 'resume'}`, { method: 'POST' });
    if (!response.ok) throw new Error('Unable to update queue');
    const data = await response.json();
    setQueueControl(data.control);
    if (paused) {
      setIsActive(false);
      setIsPaused(true);
      setPauseTimeLeft(0);
      setTimeLeft(Math.max(0, Number(data.control.queuePausedRemainingSeconds ?? timeLeft)));
    }
  }, [timeLeft]);

  const retryQueue = useCallback(async () => {
    const response = await adminFetch(`${API_BASE_URL}/api/queue/retry`, { method: 'POST' });
    if (!response.ok) throw new Error('Unable to retry queue');
    const data = await response.json();
    setQueueControl(data.control);
    await fetchImages();
  }, [fetchImages]);

  // ===== ฟังก์ชัน: ดึงประวัติการอนุมัติ/ปฏิเสธ =====
  const fetchHistory = useCallback(async () => {
    try {
      const response = await adminFetch(`${API_BASE_URL}/api/check-history`);
      if (response.ok) {
        const data = await response.json();
        setHistoryItems(data.data || data);
      }
    } catch (error) {
      console.error("Error fetching history:", error);
    }
  }, []);

  // ===== ฟังก์ชัน: ดึงตั้งค่าของขวัญจาก Backend =====
  const fetchGiftSettings = useCallback(async () => {
    try {
      const response = await adminFetch(`${API_BASE_URL}/api/gifts/settings`);
      if (response.ok) {
        const data = await response.json();
        setGiftSettings(data.items || []);
      }
    } catch (error) {
      console.error("Error fetching gift settings:", error);
    }
  }, []);

  // ===== ฟังก์ชัน: เริ่มการแสดงรูปภาพใหม่ =====
  const startPreview = useCallback(async (image) => {
    const now = Date.now();
    const imageId = image._id || image.id;
    const playingImage = { ...image, status: 'playing' };

    setCurrentPreview(playingImage);
    setTimeLeft(image.time);
    setIsActive(true);
    localStorage.setItem("currentPreview", JSON.stringify(playingImage));
    localStorage.setItem("startTimestamp", String(now));
    localStorage.setItem("duration", String(image.time));
    localStorage.setItem("isActive", "true");

    setImages(prev => prev.map(img => {
      if ((img._id === imageId) || (img.id === imageId)) {
        return { ...img, status: 'playing' };
      }
      return img;
    }));

    try {
      await adminFetch(`${API_BASE_URL}/api/playing/${imageId}`, {
        method: "POST",
      });
    } catch (err) {
      console.error("Error marking as playing:", err);
    }
  }, []);

  // ===== ฟังก์ชัน: ข้ามรูปภาพที่กำลังแสดง =====
  const handleSkipCurrent = useCallback(async () => {
    if (!currentPreview) return;
    const imageId = currentPreview._id || currentPreview.id;
    const savedQueueOrder = localStorage.getItem('queueOrder');

    try {
      await adminFetch(`${API_BASE_URL}/api/complete/${imageId}`, {
        method: "POST",
      });
    } catch (err) {
      console.error("Error skipping current image:", err);
    }

    if (socket) {
      socket.emit('skip-current');
    }

    setIsActive(false);
    setIsPaused(false);
    setCurrentPreview(null);
    setTimeLeft(0);
    setPauseTimeLeft(0);

    localStorage.removeItem("currentPreview");
    localStorage.removeItem("startTimestamp");
    localStorage.removeItem("duration");
    localStorage.removeItem("isActive");
    localStorage.removeItem("timeLeft");
    localStorage.removeItem("isPaused");
    localStorage.removeItem("pauseTimeLeft");

    if (savedQueueOrder) {
      localStorage.setItem('queueOrder', savedQueueOrder);
    }

    if (previewQueue.length > 0) {
      const nextImage = previewQueue[0];
      setPreviewQueue(prev => prev.slice(1));
      startPreview(nextImage);
    } else {
      fetchImages();
    }
  }, [currentPreview, previewQueue, startPreview, fetchImages, socket]);

  // ===== ฟังก์ชัน: นำรูปภาพจากประวัติกลับมาเข้าคิว =====
  const handleRestoreToQueue = useCallback(async (historyId) => {
    try {
      const response = await adminFetch(`${API_BASE_URL}/api/history/restore/${historyId}`, {
        method: "POST",
      });
      if (response.ok) {
        await fetchHistory();
        await fetchImages();
        setShowHistory(false);
      } else {
        alert("ไม่สามารถนำกลับเข้าคิวได้");
      }
    } catch (error) {
      console.error("Error restoring to queue:", error);
      alert("เกิดข้อผิดพลาด: " + error.message);
    }
  }, [fetchHistory, fetchImages]);

  // ===== ฟังก์ชัน: คลิกรูปภาพเพื่อดูรายละเอียด =====
  const handleImageClick = useCallback((image) => {
    setSelectedImage(image);
    setEditWidth(image.width || "");
    setEditHeight(image.height || "");
    setShowModal(true);
    if (image.type === 'gift' && image.giftOrder && image.giftOrder.items) {
      setEditGiftItems(image.giftOrder.items.map(item => ({ ...item })));
      setIsEditingGift(false);
      setShowAddGiftItem(false);
    }
  }, []);

  // ===== Drag and Drop handlers =====
  const [draggedIndex, setDraggedIndex] = useState(null);

  const handleDragStart = useCallback((e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.target.style.opacity = '0.5';
  }, []);

  const handleDragEnd = useCallback((e) => {
    e.target.style.opacity = '1';
    const queueOrder = previewQueueRef.current.map(item => item._id || item.id);
    localStorage.setItem('queueOrder', JSON.stringify(queueOrder));

    if (socket) {
      socket.emit('admin-reorder-queue', queueOrder);
    }
    setDraggedIndex(null);
  }, [socket]);

  const handleDragOver = useCallback((e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (draggedIndex === null || draggedIndex === index) return;

    const newQueue = [...previewQueueRef.current];
    const draggedItem = newQueue[draggedIndex];
    newQueue.splice(draggedIndex, 1);
    newQueue.splice(index, 0, draggedItem);

    setPreviewQueue(newQueue);
    setDraggedIndex(index);
  }, [draggedIndex]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // ===== ฟังก์ชัน: อนุมัติรูปภาพ =====
  const handleApprove = useCallback(async (id) => {
    try {
      setImages(prev => prev.map(img => {
        if ((img._id === id) || (img.id === id)) {
          return { ...img, status: 'approved', width: editWidth, height: editHeight };
        }
        return img;
      }));
      setShowModal(false);

      const response = await adminFetch(`${API_BASE_URL}/api/approve/${id}`, {
        method: "POST",
        body: JSON.stringify({
          width: editWidth,
          height: editHeight
        })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }
      fetchImages();
    } catch (error) {
      console.error("Error approving image:", error);
      alert('เกิดข้อผิดพลาด: ' + error.message);
      fetchImages();
    }
  }, [editWidth, editHeight, fetchImages]);

  // ===== ฟังก์ชัน: ปฏิเสธรูปภาพ =====
  const handleReject = useCallback(async (id) => {
    try {
      const response = await adminFetch(`${API_BASE_URL}/api/reject/${id}`, {
        method: "POST",
      });
      if (response.ok) {
        fetchImages();
        setShowModal(false);
      } else {
        alert('ไม่สามารถปฏิเสธได้');
      }
    } catch (error) {
      console.error("Error rejecting image:", error);
      alert('เกิดข้อผิดพลาด: ' + error.message);
    }
  }, [fetchImages]);

  // ===== Load initial config and setup Socket Listeners =====
  useEffect(() => {
    fetchImages();
    fetchGiftSettings();
    fetchQueueControl();

    if (!socket) return;

    const handleQueueUpdate = () => {
      fetchImages();
    };

    const handlePauseDisplay = (data) => {
      if (data?.manual) {
        setIsActive(false);
        setIsPaused(true);
        setPauseTimeLeft(0);
        return;
      }
      if (data && data.remaining !== undefined) {
        setIsActive(false);
        setCurrentPreview(null);
        localStorage.removeItem("currentPreview");
        localStorage.removeItem("isActive");
        setIsPaused(true);
        setPauseTimeLeft(data.remaining);
      }
    };

    const handleResumeDisplay = () => {
      setIsPaused(false);
      setPauseTimeLeft(0);
      fetchImages();
    };

    const handleItemCompleted = (data) => {
      const savedPreview = localStorage.getItem("currentPreview");
      const liveCurrentPreview = currentPreviewRef.current;

      if (savedPreview) {
        try {
          const preview = JSON.parse(savedPreview);
          const previewId = preview._id || preview.id;
          const completedId = data.id || data._id;

          if (previewId !== completedId) return;
        } catch (err) {
          console.error("[Socket] Error parsing preview:", err);
        }
      }

      if (!liveCurrentPreview && !localStorage.getItem("currentPreview")) return;

      setCurrentPreview(null);
      setIsActive(false);
      setTimeLeft(0);
      setIsPaused(false);
      setPauseTimeLeft(0);
      isCompletingRef.current = false;

      localStorage.removeItem("currentPreview");
      localStorage.removeItem("isActive");
      localStorage.removeItem("startTimestamp");
      localStorage.removeItem("duration");

      fetchImages();
      fetchHistory();
    };

    socket.on('admin-update-queue', handleQueueUpdate);
    socket.on('new-upload', handleQueueUpdate);
    socket.on('pause-display', handlePauseDisplay);
    socket.on('resume-display', handleResumeDisplay);
    socket.on('item-completed', handleItemCompleted);
    const handleQueueControlUpdated = (control) => {
      setQueueControl(control);
      if (control?.queuePaused) {
        setIsActive(false);
        setIsPaused(true);
        setPauseTimeLeft(0);
        setTimeLeft(Math.max(0, Number(control.queuePausedRemainingSeconds ?? 0)));
      }
    };

    socket.on('queue-control-updated', handleQueueControlUpdated);

    return () => {
      socket.off('admin-update-queue', handleQueueUpdate);
      socket.off('new-upload', handleQueueUpdate);
      socket.off('pause-display', handlePauseDisplay);
      socket.off('resume-display', handleResumeDisplay);
      socket.off('item-completed', handleItemCompleted);
      socket.off('queue-control-updated', handleQueueControlUpdated);
    };
  }, [socket, fetchImages, fetchGiftSettings, fetchHistory, fetchQueueControl]);

  // Polling fallback
  useEffect(() => {
    const pollInterval = setInterval(() => {
      fetchImages();
    }, 5000);
    return () => clearInterval(pollInterval);
  }, [fetchImages]);

  // Main countdown timer
  useEffect(() => {
    let interval = null;
    if (isActive && currentPreview) {
      interval = setInterval(() => {
        const startTimestamp = Number(localStorage.getItem("startTimestamp"));
        const duration = Number(localStorage.getItem("duration"));
        const now = Date.now();
        const elapsed = Math.floor((now - startTimestamp) / 1000);
        const left = duration - elapsed;
        setTimeLeft(left > 0 ? left : 0);

        if (left <= 0 && !isCompletingRef.current) {
          isCompletingRef.current = true;
          clearInterval(interval);
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, currentPreview]);

  // Pause countdown timer
  useEffect(() => {
    let countdownTimer = null;
    if (isPaused && pauseTimeLeft > 0) {
      countdownTimer = setInterval(() => {
        setPauseTimeLeft(prev => {
          const newVal = prev - 1;
          if (newVal <= 0) {
            clearInterval(countdownTimer);
            setTimeout(() => {
              setIsPaused(false);
              setPauseTimeLeft(0);
            }, 100);
            return 0;
          }
          return newVal;
        });
      }, 1000);
    }
    return () => {
      if (countdownTimer) clearInterval(countdownTimer);
    };
  }, [isPaused, pauseTimeLeft]);

  // Restore State on Mount
  useEffect(() => {
    const savedPreview = localStorage.getItem("currentPreview");
    const savedIsActive = localStorage.getItem("isActive");
    const startTimestamp = Number(localStorage.getItem("startTimestamp"));
    const duration = Number(localStorage.getItem("duration"));

    if (savedPreview && savedIsActive === "true" && startTimestamp && duration) {
      const now = Date.now();
      const elapsed = Math.floor((now - startTimestamp) / 1000);
      const left = duration - elapsed;

      if (left > 0) {
        setCurrentPreview(JSON.parse(savedPreview));
        setTimeLeft(left);
        setIsActive(true);
      } else {
        setCurrentPreview(null);
        setIsActive(false);
        localStorage.removeItem("currentPreview");
        localStorage.removeItem("startTimestamp");
        localStorage.removeItem("duration");
        localStorage.removeItem("isActive");
      }
    }
  }, []);

  // Save State to LocalStorage
  useEffect(() => {
    if (currentPreview && isActive) {
      localStorage.setItem("currentPreview", JSON.stringify(currentPreview));
      localStorage.setItem("timeLeft", String(timeLeft));
      localStorage.setItem("isActive", "true");
      localStorage.setItem("isPaused", String(isPaused));
      localStorage.setItem("pauseTimeLeft", String(pauseTimeLeft));
    } else {
      localStorage.removeItem("currentPreview");
      localStorage.removeItem("timeLeft");
      localStorage.removeItem("isActive");
      localStorage.removeItem("isPaused");
      localStorage.removeItem("pauseTimeLeft");
    }
  }, [currentPreview, timeLeft, isActive, isPaused, pauseTimeLeft]);

  // Sync approved items to local queue
  useEffect(() => {
    if (loading) return;
    if (draggedIndex !== null) return;

    const approvedItemsFromServer = images.filter(img => img.status === "approved");
    const approvedIds = new Set(approvedItemsFromServer.map(img => img._id || img.id));

    const savedOrderJson = localStorage.getItem('queueOrder');
    const savedOrder = savedOrderJson ? JSON.parse(savedOrderJson) : [];

    setPreviewQueue(prev => {
      const cleanedQueue = prev.filter(item => {
        const id = item._id || item.id;
        return approvedIds.has(id);
      });

      const currentIds = new Set(cleanedQueue.map(p => p._id || p.id));
      const currentPlayingId = currentPreview ? (currentPreview._id || currentPreview.id) : null;

      const newItems = approvedItemsFromServer.filter(item => {
        const itemId = item._id || item.id;
        if (currentIds.has(itemId)) return false;
        if (currentPlayingId && currentPlayingId === itemId) return false;
        if (completedIdsRef.current.has(itemId)) return false;
        return true;
      });

      let mergedQueue = [...cleanedQueue, ...newItems];

      if (savedOrder.length > 0) {
        mergedQueue.sort((a, b) => {
          const aId = a._id || a.id;
          const bId = b._id || b.id;
          const aIndex = savedOrder.indexOf(aId);
          const bIndex = savedOrder.indexOf(bId);

          if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
          if (aIndex !== -1) return -1;
          if (bIndex !== -1) return 1;

          return new Date(a.receivedAt || a.createdAt) - new Date(b.receivedAt || b.createdAt);
        });
      } else {
        mergedQueue.sort((a, b) => new Date(a.receivedAt || a.createdAt) - new Date(b.receivedAt || b.createdAt));
      }

      const prevIds = prev.map(i => i._id || i.id).join(',');
      const newIds = mergedQueue.map(i => i._id || i.id).join(',');

      if (prevIds !== newIds) return mergedQueue;
      return prev;
    });
  }, [images, loading, currentPreview, draggedIndex]);

  const totalDuration = currentPreview ? Math.max(currentPreview.time || 0, 1) : 1;
  const progressRatio = Math.max(0, Math.min(1, (totalDuration - timeLeft) / totalDuration));

  return {
    socket,
    shopId,
    isSocketConnected,
    images,
    loading,
    selectedImage,
    setSelectedImage,
    showModal,
    setShowModal,
    showHistory,
    setShowHistory,
    historyItems,
    categoryFilter,
    setCategoryFilter,
    giftSettings,
    editWidth,
    setEditWidth,
    editHeight,
    setEditHeight,
    editGiftItems,
    setEditGiftItems,
    isEditingGift,
    setIsEditingGift,
    showAddGiftItem,
    setShowAddGiftItem,
    savingGiftItems,
    setSavingGiftItems,
    currentPreview,
    previewQueue,
    timeLeft,
    isActive,
    isPaused,
    pauseTimeLeft,
    queueControl,
    totalDuration,
    progressRatio,
    getImageUrl,
    fetchImages,
    fetchHistory,
    handleSkipCurrent,
    setPlaybackPaused,
    retryQueue,
    handleRestoreToQueue,
    handleImageClick,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    handleApprove,
    handleReject,
    draggedIndex
  };
}
