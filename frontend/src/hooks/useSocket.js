import { useContext, useEffect } from 'react';
import { HomeContext } from '../contexts/HomeContext';
import { API_BASE_URL } from '../config/apiConfig';
import adminFetch from '../config/authFetch';

/**
 * Custom hook to manage all socket subscriptions and real-time state synchronizations.
 * Built with robust socket listener cleanups to prevent memory leaks.
 */
export default function useSocket() {
  const {
    socket,
    systemOn, setSystemOn,
    enableImage, setEnableImage,
    enableText, setEnableText,
    enableGift, setEnableGift,
    enableBirthday, setEnableBirthday,
    freeMode, setFreeMode,
    queueAccepting, setQueueAccepting,
    setPublicRankingType,
    showToast
  } = useContext(HomeContext);

  // Persist control changes through the authenticated Admin API. Socket.IO
  // broadcasts the confirmed result, but must not be the sole write path:
  // an expired/disconnected socket can otherwise make a switch look saved
  // even though the server rejected it.
  const persistConfig = async (updates, rollback) => {
    try {
      const response = await adminFetch(`${API_BASE_URL}/api/config/update`, {
        method: 'POST',
        body: JSON.stringify(updates),
      });

      if (response.ok) return true;

      const result = await response.json().catch(() => ({}));
      rollback?.();
      showToast(result.message || 'บันทึกการตั้งค่าไม่สำเร็จ กรุณาลองใหม่', 'error');
      return false;
    } catch (error) {
      console.error('[Admin] Unable to save system config:', error);
      rollback?.();
      showToast('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ สถานะถูกคืนค่าแล้ว', 'error');
      return false;
    }
  };

  // Sync state config on status broadcast
  useEffect(() => {
    if (!socket) return;

    const handleStatus = (config) => {
      setSystemOn(config.systemOpen ?? config.systemOn ?? true);
      setEnableImage(config.enableImage ?? true);
      setEnableText(config.enableText ?? true);
      setEnableGift(config.enableGift ?? true);
      setEnableBirthday(config.enableBirthday ?? true);
      setFreeMode(config.freeMode === true);
      setQueueAccepting(config.queueAccepting !== false);
    };

    socket.on("status", handleStatus);
    socket.emit("getConfig");

    return () => {
      socket.off("status", handleStatus);
    };
  }, [socket, setSystemOn, setEnableImage, setEnableText, setEnableGift, setEnableBirthday, setFreeMode, setQueueAccepting]);

  // Sync public ranking layouts updates
  useEffect(() => {
    if (!socket) return;

    const handlePublicRankingUpdated = (data) => {
      setPublicRankingType(data.type);
    };

    socket.on("publicRankingTypeUpdated", handlePublicRankingUpdated);

    return () => {
      socket.off("publicRankingTypeUpdated", handlePublicRankingUpdated);
    };
  }, [socket, setPublicRankingType]);

  const handleToggleSystem = () => {
    const newStatus = !systemOn;
    const previous = { systemOn, enableImage, enableText, enableGift, enableBirthday };
    setSystemOn(newStatus);

    if (!newStatus) {
      setEnableImage(false);
      setEnableText(false);
      setEnableGift(false);
      setEnableBirthday(false);
      persistConfig({
        systemOpen: newStatus,
        enableImage: false,
        enableText: false,
        enableGift: false,
        enableBirthday: false,
      }, () => {
        setSystemOn(previous.systemOn);
        setEnableImage(previous.enableImage);
        setEnableText(previous.enableText);
        setEnableGift(previous.enableGift);
        setEnableBirthday(previous.enableBirthday);
      });
    } else {
      setEnableImage(true);
      setEnableText(true);
      setEnableGift(true);
      setEnableBirthday(true);
      persistConfig({
        systemOpen: newStatus,
        enableImage: true,
        enableText: true,
        enableGift: true,
        enableBirthday: true,
      }, () => {
        setSystemOn(previous.systemOn);
        setEnableImage(previous.enableImage);
        setEnableText(previous.enableText);
        setEnableGift(previous.enableGift);
        setEnableBirthday(previous.enableBirthday);
      });
    }
  };

  const handleToggleImage = () => {
    const newStatus = !enableImage;
    setEnableImage(newStatus);
    persistConfig({
      enableImage: newStatus,
      systemOpen: systemOn,
      enableText,
      enableGift,
      enableBirthday,
    }, () => setEnableImage(enableImage));
  };

  const handleToggleText = () => {
    const newStatus = !enableText;
    setEnableText(newStatus);
    persistConfig({
      enableText: newStatus,
      systemOpen: systemOn,
      enableImage,
      enableGift,
      enableBirthday,
    }, () => setEnableText(enableText));
  };

  const handleToggleGift = () => {
    const newStatus = !enableGift;
    setEnableGift(newStatus);
    persistConfig({
      enableGift: newStatus,
      systemOpen: systemOn,
      enableImage,
      enableText,
      enableBirthday,
    }, () => setEnableGift(enableGift));
  };

  const handleToggleBirthday = () => {
    const newStatus = !enableBirthday;
    setEnableBirthday(newStatus);
    persistConfig({
      enableBirthday: newStatus,
      systemOpen: systemOn,
      enableImage,
      enableText,
      enableGift,
    }, () => setEnableBirthday(enableBirthday));
  };

  const handleToggleFreeMode = () => {
    const nextFreeMode = !freeMode;
    setFreeMode(nextFreeMode);
    persistConfig({ freeMode: nextFreeMode }, () => setFreeMode(freeMode));
  };

  // This is intentionally separate from the master system switch. It keeps
  // all existing queue records and feature choices intact while staff pause
  // new customer submissions during an operational issue.
  const handleToggleQueueAccepting = () => {
    const nextQueueAccepting = !queueAccepting;
    setQueueAccepting(nextQueueAccepting);
    persistConfig({ queueAccepting: nextQueueAccepting }, () => setQueueAccepting(queueAccepting));
  };

  return {
    handleToggleSystem,
    handleToggleImage,
    handleToggleText,
    handleToggleGift,
    handleToggleBirthday,
    handleToggleFreeMode,
    handleToggleQueueAccepting
  };
}
