import { useState, useEffect, useRef, useCallback } from "react";
import { REALTIME_URL } from "../config/apiConfig";
import adminFetch from "../config/authFetch";

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default function useLuckyWheel() {
  const [segments, setSegments] = useState(["โต๊ะ 1", "โต๊ะ 2", "โต๊ะ 3"]);
  const [input, setInput] = useState("");
  const [tableRange, setTableRange] = useState({ from: "", to: "" });
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState(null);
  const [editIndex, setEditIndex] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [popupEffect, setPopupEffect] = useState(false);
  const [reward, setReward] = useState("");
  const [previewing, setPreviewing] = useState(false);

  const textareaRef = useRef(null);
  const wheelRef = useRef(null);

  // Sync with OBS when segments change and previewing is active
  useEffect(() => {
    if (previewing && segments.length > 0) {
      adminFetch(`${REALTIME_URL}/api/lucky-wheel/preview`, {
        method: "POST",
        body: JSON.stringify({ segments })
      }).catch(err => console.error(err));
    }
  }, [segments, previewing]);

  const handleAddFromTextarea = useCallback(() => {
    const lines = input
      .split("\n")
      .map(line => line.trim())
      .filter(line => line);
    if (lines.length > 0) {
      setSegments(prev => [...prev, ...lines]);
      setInput("");
    }
  }, [input]);

  // Keyboard shortcut: Ctrl+Enter to add segments from textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleKeyDown = (e) => {
      if (e.key === " " && !e.shiftKey && !e.ctrlKey && !e.altKey) {
        return;
      }
      if (e.key === "Enter" && e.ctrlKey) {
        e.preventDefault();
        handleAddFromTextarea();
      }
    };

    textarea.addEventListener("keydown", handleKeyDown);
    return () => textarea.removeEventListener("keydown", handleKeyDown);
  }, [handleAddFromTextarea]);

  const togglePreview = () => {
    const newState = !previewing;
    setPreviewing(newState);

    if (newState) {
      adminFetch(`${REALTIME_URL}/api/lucky-wheel/preview`, {
        method: "POST",
        body: JSON.stringify({ segments })
      }).catch(err => console.error(err));
    } else {
      adminFetch(`${REALTIME_URL}/api/lucky-wheel/hide`, {
        method: "POST"
      }).catch(err => console.error(err));
    }
  };

  const handleAddTables = () => {
    const from = parseInt(tableRange.from);
    const to = parseInt(tableRange.to);
    if (!isNaN(from) && !isNaN(to) && from <= to && from > 0 && to - from < 200) {
      const newTables = [];
      for (let i = from; i <= to; i++) {
        newTables.push(`โต๊ะ ${i}`);
      }
      setSegments(prev => [...prev, ...newTables]);
      setTableRange({ from: "", to: "" });
    }
  };

  const handleDelete = (idx) => {
    setSegments(prev => prev.filter((_, i) => i !== idx));
    if (editIndex === idx) setEditIndex(null);
  };

  const handleDeleteAll = () => {
    if (window.confirm("ยืนยันการลบทั้งหมด?")) {
      setSegments([]);
      setEditIndex(null);
    }
  };

  const handleEdit = (idx) => {
    setEditIndex(idx);
    setEditValue(segments[idx]);
  };

  const handleEditSave = (idx) => {
    if (editValue.trim()) {
      const newSeg = [...segments];
      newSeg[idx] = editValue.trim();
      setSegments(newSeg);
      setEditIndex(null);
    }
  };

  const spinWheelWithSegments = useCallback((segs) => {
    if (segs.length < 2 || spinning) return;

    setWinner(null);
    setSpinning(true);
    setShowPopup(false);
    setPopupEffect(false);

    const winnerIdx = getRandomInt(0, segs.length - 1);
    const degPerSeg = 360 / segs.length;
    const finalDeg = 360 * 30 + (360 - winnerIdx * degPerSeg - degPerSeg / 2);

    // Send spin trigger to OBS
    adminFetch(`${REALTIME_URL}/api/lucky-wheel/spin`, {
      method: "POST",
      body: JSON.stringify({
        segments: segs,
        winnerIndex: winnerIdx,
        reward
      })
    }).then(res => res.json())
      .then(data => console.log('OBS Spin triggered:', data))
      .catch(err => console.error('Error triggering OBS:', err));

    // Handle wheel spinning CSS transition
    if (wheelRef.current) {
      wheelRef.current.style.transition = "none";
      wheelRef.current.style.transform = "rotate(0deg)";
      setTimeout(() => {
        wheelRef.current.style.transition = "transform 25s cubic-bezier(0.08, 0.8, 0.05, 1)";
        wheelRef.current.style.transform = `rotate(${finalDeg}deg)`;
      }, 50);
    }

    // Display winner popup after 25s
    setTimeout(() => {
      setSpinning(false);
      setWinner(winnerIdx);
      setShowPopup(true);
      setTimeout(() => setPopupEffect(true), 50);
    }, 25100);
  }, [spinning, reward]);

  const spinWheel = () => {
    spinWheelWithSegments(segments);
  };

  const closePopup = () => {
    setPopupEffect(false);
    setTimeout(() => setShowPopup(false), 300);
  };

  const removeWinnerAndRespin = () => {
    if (winner === null) return;
    const newSegments = segments.filter((_, i) => i !== winner);
    setSegments(newSegments);
    setPopupEffect(false);
    setShowPopup(false);
    setWinner(null);

    if (newSegments.length >= 2) {
      setPreviewing(true);
      setTimeout(() => {
        spinWheelWithSegments(newSegments);
      }, 500);
    }
  };

  return {
    segments,
    input,
    setInput,
    tableRange,
    setTableRange,
    spinning,
    winner,
    editIndex,
    setEditIndex,
    editValue,
    setEditValue,
    showPopup,
    popupEffect,
    reward,
    setReward,
    previewing,
    textareaRef,
    wheelRef,
    togglePreview,
    handleAddFromTextarea,
    handleAddTables,
    handleDelete,
    handleDeleteAll,
    handleEdit,
    handleEditSave,
    spinWheel,
    closePopup,
    removeWinnerAndRespin
  };
}
