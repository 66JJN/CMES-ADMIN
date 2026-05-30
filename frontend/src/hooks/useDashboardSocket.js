import { useContext, useEffect } from 'react';
import { HomeContext } from '../contexts/HomeContext';

/**
 * Custom hook to manage all socket subscriptions and real-time state synchronizations.
 */
export default function useDashboardSocket() {
  const {
    socket,
    systemOn, setSystemOn,
    enableImage, setEnableImage,
    enableText, setEnableText,
    enableGift, setEnableGift,
    enableBirthday, setEnableBirthday,
    setPublicRankingType
  } = useContext(HomeContext);

  // Sync state config on status broadcast
  useEffect(() => {
    if (!socket) return;

    socket.on("status", (config) => {
      setSystemOn(config.systemOpen ?? config.systemOn ?? true);
      setEnableImage(config.enableImage ?? true);
      setEnableText(config.enableText ?? true);
      setEnableGift(config.enableGift ?? true);
      setEnableBirthday(config.enableBirthday ?? true);
    });

    socket.emit("getConfig");

    return () => socket.off("status");
  }, [socket, setSystemOn, setEnableImage, setEnableText, setEnableGift, setEnableBirthday]);

  // Sync public ranking layouts updates
  useEffect(() => {
    if (!socket) return;

    socket.on("publicRankingTypeUpdated", (data) => {
      setPublicRankingType(data.type);
    });

    return () => socket.off("publicRankingTypeUpdated");
  }, [socket, setPublicRankingType]);

  const handleToggleSystem = () => {
    if (!socket) return;
    const newStatus = !systemOn;
    setSystemOn(newStatus);

    if (!newStatus) {
      setEnableImage(false);
      setEnableText(false);
      setEnableGift(false);
      setEnableBirthday(false);
      socket.emit("adminUpdateConfig", {
        systemOpen: newStatus,
        enableImage: false,
        enableText: false,
        enableGift: false,
        enableBirthday: false,
      });
    } else {
      setEnableImage(true);
      setEnableText(true);
      setEnableGift(true);
      setEnableBirthday(true);
      socket.emit("adminUpdateConfig", {
        systemOpen: newStatus,
        enableImage: true,
        enableText: true,
        enableGift: true,
        enableBirthday: true,
      });
    }
  };

  const handleToggleImage = () => {
    if (!socket) return;
    const newStatus = !enableImage;
    setEnableImage(newStatus);
    socket.emit("adminUpdateConfig", {
      enableImage: newStatus,
      systemOpen: systemOn,
      enableText,
      enableGift,
      enableBirthday,
    });
  };

  const handleToggleText = () => {
    if (!socket) return;
    const newStatus = !enableText;
    setEnableText(newStatus);
    socket.emit("adminUpdateConfig", {
      enableText: newStatus,
      systemOpen: systemOn,
      enableImage,
      enableGift,
      enableBirthday,
    });
  };

  const handleToggleGift = () => {
    if (!socket) return;
    const newStatus = !enableGift;
    setEnableGift(newStatus);
    socket.emit("adminUpdateConfig", {
      enableGift: newStatus,
      systemOpen: systemOn,
      enableImage,
      enableText,
      enableBirthday,
    });
  };

  const handleToggleBirthday = () => {
    if (!socket) return;
    const newStatus = !enableBirthday;
    setEnableBirthday(newStatus);
    socket.emit("adminUpdateConfig", {
      enableBirthday: newStatus,
      systemOpen: systemOn,
      enableImage,
      enableText,
      enableGift,
    });
  };

  return {
    handleToggleSystem,
    handleToggleImage,
    handleToggleText,
    handleToggleGift,
    handleToggleBirthday
  };
}
