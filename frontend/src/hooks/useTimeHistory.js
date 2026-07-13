import { useEffect, useState, useContext, useCallback } from "react";
import { API_BASE_URL } from "../config/apiConfig";
import adminFetch from "../config/authFetch";
import { ShopContext } from "../contexts/ShopContext";

/**
 * Custom Hook for managing setting time history.
 * Fetches time histories using API with active polling and real-time Socket.IO synchronization.
 * Supports snappy optimistic UI updates on item deletion.
 */
export default function useTimeHistory() {
  const [history, setHistory] = useState([]);
  const { socket } = useContext(ShopContext);

  // Fetch from REST API
  const fetchHistory = useCallback(async () => {
    try {
      const response = await adminFetch(`${API_BASE_URL}/api/time-history`);
      if (response.ok) {
        const data = await response.json();
        console.log("[TimeHistory] Fetched history:", data);
        setHistory(data);
      }
    } catch (error) {
      console.error("[TimeHistory] Error fetching history:", error);
    }
  }, []);

  // Set up polling and socket events
  useEffect(() => {
    // Initial fetch
    fetchHistory();

    // 5-second polling fallback
    const interval = setInterval(fetchHistory, 5000);

    if (!socket) {
      console.log("[TimeHistory] Socket not available yet");
      return () => clearInterval(interval);
    }

    // Refetch when status config updates
    const handleStatusUpdate = () => {
      console.log("[TimeHistory] Received status event, refetching...");
      fetchHistory();
    };

    socket.on("status", handleStatusUpdate);

    return () => {
      clearInterval(interval);
      if (socket) {
        socket.off("status", handleStatusUpdate);
      }
    };
  }, [socket, fetchHistory]);

  // Handle remove with optimistic UI update
  const handleRemove = useCallback((id) => {
    // Optimistic Update: remove from local state immediately
    setHistory((prev) => prev.filter((item) => item.id !== id));

    if (socket) {
      socket.emit("removeSetting", id);
    } else {
      console.warn("[TimeHistory] Cannot remove - socket not connected");
    }
  }, [socket]);

  // Categorize histories
  const textHistory = history.filter((item) => item.mode === "text");
  const imageHistory = history.filter((item) => item.mode === "image");
  const birthdayHistory = history.filter((item) => item.mode === "birthday");

  return {
    history,
    textHistory,
    imageHistory,
    birthdayHistory,
    handleRemove,
  };
}
