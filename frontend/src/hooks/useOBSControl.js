import { useState, useEffect, useRef, useCallback } from "react";
import OBSWebSocket from "obs-websocket-js";
import adminFetch from "../config/authFetch";

/**
 * Custom Hook for handling OBS Studio WebSocket controls.
 * Manages connection, scenes, audio muting, text inputs, dragging positions,
 * and clears pending timers/listeners to prevent memory leaks.
 */
export default function useOBSControl({ API_BASE_URL, adminId, shopId }) {
  const [url, setUrl] = useState("ws://localhost:4455");
  const [password, setPassword] = useState("");
  const [isConnected, setIsConnected] = useState(false);

  const [scenes, setScenes] = useState([]);
  const [currentScene, setCurrentScene] = useState("");
  const [marqueeText, setMarqueeText] = useState("");
  const [bgmMuted, setBgmMuted] = useState(false);
  const [logs, setLogs] = useState([]);

  const obsRef = useRef(null);
  if (!obsRef.current) {
    obsRef.current = new OBSWebSocket();
  }

  const logsEndRef = useRef(null);
  const canvasRef = useRef(null);
  const draggingRef = useRef(null);
  const timeoutRef = useRef(null); // Ref to track pending connection timers

  const [overlayItems, setOverlayItems] = useState({});
  const [dragging, setDragging] = useState(null);

  const addLog = useCallback((msg, type = "info") => {
    setLogs((prev) => [
      ...prev,
      { time: new Date().toLocaleTimeString(), msg, type },
    ]);
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Fetch list of scene items
  const fetchSceneItems = useCallback(async (obs, sceneName) => {
    try {
      const { sceneItems } = await obs.call("GetSceneItemList", { sceneName });
      const items = {};
      for (const item of sceneItems) {
        try {
          const { sceneItemTransform } = await obs.call("GetSceneItemTransform", {
            sceneName,
            sceneItemId: item.sceneItemId,
          });
          items[item.sourceName] = {
            sceneItemId: item.sceneItemId,
            x: sceneItemTransform.positionX || 0,
            y: sceneItemTransform.positionY || 0,
            enabled: item.sceneItemEnabled,
          };
        } catch (e) {
          // ignore individual item fetch errors
        }
      }
      setOverlayItems(items);
    } catch (err) {
      addLog(`Failed to fetch scene items: ${err.message}`, "error");
    }
  }, [addLog]);

  // Browser sources use a read-only display token. The token is deliberately
  // different from the admin session and is required by the Admin Socket.IO
  // server, so an automatically created source cannot omit it.
  const getDisplayToken = useCallback(async () => {
    const response = await adminFetch(`${API_BASE_URL}/api/obs/display-token`);
    const data = await response.json();
    if (!response.ok || !data.success || !data.token) {
      throw new Error(data.message || "Unable to create OBS display token");
    }
    return data.token;
  }, [API_BASE_URL]);

  // Setup auto creation of overlay inputs
  const autoCreateRequiredSources = useCallback(async (obs, sceneName) => {
    try {
      addLog(`🔍 ตรวจสอบโครงสร้างพื้นฐานใน Scene: ${sceneName}...`, "info");

      const { sceneItems } = await obs.call("GetSceneItemList", { sceneName });
      const existingSourceNames = sceneItems.map((item) => item.sourceName);
      const targetShopId = shopId || adminId;
      const displayToken = await getDisplayToken();
      const displayQuery = `shopId=${encodeURIComponent(targetShopId)}&token=${encodeURIComponent(displayToken)}`;

      const ensureBrowserSource = async (inputName, url) => {
        if (existingSourceNames.includes(inputName)) {
          const { inputSettings = {} } = await obs.call("GetInputSettings", { inputName });
          if (inputSettings.url !== url) {
            await obs.call("SetInputSettings", {
              inputName,
              inputSettings: { url, width: 1920, height: 1080 },
              overlay: true,
            });
            addLog(`🔄 Updated '${inputName}' with a fresh secure display link`, "success");
          }
          return;
        }

        addLog(`⏳ Creating '${inputName}'...`, "warning");
        await obs.call("CreateInput", {
          sceneName,
          inputName,
          inputKind: "browser_source",
          inputSettings: { url, width: 1920, height: 1080 },
        });
        addLog(`✅ Created '${inputName}'`, "success");
      };

      // 1. Overlay Browser Sources
      await ensureBrowserSource("Overlay_ImageText", `${API_BASE_URL}/obs-image-overlay.html?${displayQuery}`);
      await ensureBrowserSource("Overlay_Ranking", `${API_BASE_URL}/obs-ranking-overlay.html?${displayQuery}`);
      await ensureBrowserSource("Overlay_LuckyWheel", `${API_BASE_URL}/obs-lucky-wheel.html?${displayQuery}`);

      // 2. Marquee Text Source
      if (!existingSourceNames.includes("MarqueeText")) {
        addLog(`⏳ กำลังสร้าง 'MarqueeText'...`, "warning");
        try {
          await obs.call("CreateInput", {
            sceneName: sceneName,
            inputName: "MarqueeText",
            inputKind: "text_gdiplus_v2",
            inputSettings: {
              text: "ยินดีต้อนรับเข้าสู่ระบบจัดการ",
              font: { face: "Arial", size: 72, style: "Bold" },
            },
          });
          addLog(`✅ สร้าง 'MarqueeText' สำเร็จ! (Windows)`, "success");
        } catch (e) {
          await obs.call("CreateInput", {
            sceneName: sceneName,
            inputName: "MarqueeText",
            inputKind: "text_ft2_source_v2",
            inputSettings: {
              text: "ยินดีต้อนรับเข้าสู่ระบบจัดการ",
              font: { face: "Arial", size: 72, style: "Bold" },
            },
          });
          addLog(`✅ สร้าง 'MarqueeText' สำเร็จ! (Mac/Linux)`, "success");
        }
      }

      // 3. Audio BGM Source
      if (!existingSourceNames.includes("BGM")) {
        addLog(`⏳ กำลังสร้าง 'BGM' (Audio)...`, "warning");
        await obs.call("CreateInput", {
          sceneName: sceneName,
          inputName: "BGM",
          inputKind: "ffmpeg_source",
          inputSettings: {
            is_local_file: false,
            looping: true,
          },
        });
        addLog(`✅ สร้าง 'BGM' สำเร็จ!`, "success");
      }

      addLog(`🎉 สภาพแวดล้อมพร้อมใช้งานแล้ว!`, "success");
    } catch (err) {
      addLog(`❌ Auto-Create failed: ${err.message}`, "error");
    }
  }, [API_BASE_URL, adminId, shopId, addLog, getDisplayToken]);

  // Fetch all startup data from OBS
  const fetchInitialData = useCallback(async () => {
    const obs = obsRef.current;
    try {
      const sceneList = await obs.call("GetSceneList");
      const currentProgramScene = sceneList.currentProgramSceneName;
      setScenes(sceneList.scenes.map((s) => s.sceneName).reverse());
      setCurrentScene(currentProgramScene);

      if (currentProgramScene) {
        await autoCreateRequiredSources(obs, currentProgramScene);
        await fetchSceneItems(obs, currentProgramScene);
      }

      try {
        const { inputMuted } = await obs.call("GetInputMute", {
          inputName: "BGM",
        });
        setBgmMuted(inputMuted);
      } catch (err) {
        // mute state not set yet
      }
    } catch (err) {
      addLog(`Fetch error: ${err.message}`, "error");
    }
  }, [autoCreateRequiredSources, fetchSceneItems, addLog]);

  // Setup WS listeners
  useEffect(() => {
    const obs = obsRef.current;

    const onConnect = () => {
      setIsConnected(true);
      addLog("🟢 Connected to OBS Studio successfully", "success");
      
      // Cleanup previous timeout if existing
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      // Add safety timer to fetch initial settings after web socket initializes
      timeoutRef.current = setTimeout(() => {
        fetchInitialData();
      }, 500);
    };

    const onDisconnect = () => {
      setIsConnected(false);
      addLog("🔴 Disconnected from OBS Studio", "error");
    };

    const onSceneChanged = (data) => {
      setCurrentScene(data.sceneName);
      addLog(`📺 Scene switched to: ${data.sceneName}`, "info");
      fetchSceneItems(obs, data.sceneName);
    };

    const onInputMuteStateChanged = (data) => {
      if (data.inputName === "BGM") {
        setBgmMuted(data.inputMuted);
      }
    };

    const onSceneItemTransformChanged = (data) => {
      if (draggingRef.current && draggingRef.current.sceneItemId === data.sceneItemId) return;
      setOverlayItems((prev) => {
        const updated = { ...prev };
        for (const [name, item] of Object.entries(updated)) {
          if (item.sceneItemId === data.sceneItemId) {
            updated[name] = {
              ...item,
              x: data.sceneItemTransform.positionX ?? item.x,
              y: data.sceneItemTransform.positionY ?? item.y,
            };
            break;
          }
        }
        return updated;
      });
    };

    const onSceneItemEnableStateChanged = (data) => {
      setOverlayItems((prev) => {
        const updated = { ...prev };
        for (const [name, item] of Object.entries(updated)) {
          if (item.sceneItemId === data.sceneItemId) {
            updated[name] = { ...item, enabled: data.sceneItemEnabled };
            break;
          }
        }
        return updated;
      });
    };

    obs.on("ConnectionOpened", onConnect);
    obs.on("ConnectionClosed", onDisconnect);
    obs.on("CurrentProgramSceneChanged", onSceneChanged);
    obs.on("InputMuteStateChanged", onInputMuteStateChanged);
    obs.on("SceneItemTransformChanged", onSceneItemTransformChanged);
    obs.on("SceneItemEnableStateChanged", onSceneItemEnableStateChanged);

    return () => {
      obs.removeAllListeners();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      obs.disconnect().catch(() => {});
    };
  }, [fetchInitialData, fetchSceneItems, addLog]);

  // Connect/Disconnect controls
  const handleConnect = useCallback(async () => {
    if (isConnected) {
      try {
        await obsRef.current.disconnect();
      } catch (err) {
        console.error(err);
      }
      return;
    }
    try {
      addLog(`Connecting to ${url}...`, "info");
      const { obsWebSocketVersion } = await obsRef.current.connect(url, password, {
        rpcVersion: 1,
      });
      addLog(`OBS Studio Version: ${obsWebSocketVersion}`, "info");
    } catch (err) {
      addLog(`Connection failed: ${err.message}`, "error");
    }
  }, [isConnected, url, password, addLog]);

  // Actions Control
  const handleSceneSwitch = useCallback(async (sceneName) => {
    try {
      await obsRef.current.call("SetCurrentProgramScene", { sceneName });
    } catch (err) {
      addLog(`Failed to switch scene: ${err.message}`, "error");
    }
  }, [addLog]);

  const handleEmergencyHide = useCallback(async (sourceName, show) => {
    try {
      if (!currentScene) throw new Error("No active scene");

      const { sceneItemId } = await obsRef.current.call("GetSceneItemId", {
        sceneName: currentScene,
        sourceName: sourceName,
      });

      await obsRef.current.call("SetSceneItemEnabled", {
        sceneName: currentScene,
        sceneItemId: sceneItemId,
        sceneItemEnabled: show,
      });

      addLog(
        show ? `👁️ ${sourceName} shown` : `🚫 ${sourceName} HIDDEN`,
        show ? "success" : "warning"
      );
    } catch (err) {
      addLog(
        `Hide/Show failed: ${err.message} (Is '${sourceName}' in this scene?)`,
        "error"
      );
    }
  }, [currentScene, addLog]);

  const handleMarqueeUpdate = useCallback(async (textToSet) => {
    try {
      await obsRef.current.call("SetInputSettings", {
        inputName: "MarqueeText",
        inputSettings: { text: textToSet },
      });
      setMarqueeText(textToSet);
      addLog(
        textToSet
          ? `📝 Marquee updated to: "${textToSet}"`
          : "🗑️ Marquee text cleared",
        "success"
      );
    } catch (err) {
      addLog(`Marquee update failed: ${err.message}`, "error");
    }
  }, [addLog]);

  const handleToggleMute = useCallback(async () => {
    try {
      await obsRef.current.call("ToggleInputMute", { inputName: "BGM" });
    } catch (err) {
      addLog(`Audio control failed: ${err.message}`, "error");
    }
  }, [addLog]);

  // Drag and Drop canvas math logic
  const handleCanvasMouseDown = useCallback((e, sourceName) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const item = overlayItems[sourceName];
    const dragData = {
      sourceName,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startItemX: item?.x || 0,
      startItemY: item?.y || 0,
      scaleX: 1920 / rect.width,
      scaleY: 1080 / rect.height,
      sceneItemId: item?.sceneItemId,
      currentX: item?.x || 0,
      currentY: item?.y || 0,
    };
    draggingRef.current = dragData;
    setDragging(sourceName);
  }, [overlayItems]);

  const handleCanvasMouseMove = useCallback((e) => {
    const drag = draggingRef.current;
    if (!drag) return;
    const dx = (e.clientX - drag.startMouseX) * drag.scaleX;
    const dy = (e.clientY - drag.startMouseY) * drag.scaleY;
    drag.currentX = drag.startItemX + dx;
    drag.currentY = drag.startItemY + dy;
    setOverlayItems((prev) => ({
      ...prev,
      [drag.sourceName]: {
        ...prev[drag.sourceName],
        x: drag.currentX,
        y: drag.currentY,
      },
    }));
  }, []);

  const handleCanvasMouseUp = useCallback(async () => {
    const drag = draggingRef.current;
    if (!drag) return;
    draggingRef.current = null;
    setDragging(null);
    const finalX = Math.round(drag.currentX);
    const finalY = Math.round(drag.currentY);
    try {
      await obsRef.current.call("SetSceneItemTransform", {
        sceneName: currentScene,
        sceneItemId: drag.sceneItemId,
        sceneItemTransform: {
          positionX: finalX,
          positionY: finalY,
        },
      });
      addLog(`📐 ${drag.sourceName} → (${finalX}, ${finalY})`, "success");
    } catch (err) {
      addLog(`Move failed: ${err.message}`, "error");
    }
  }, [currentScene, addLog]);

  return {
    url,
    setUrl,
    password,
    setPassword,
    isConnected,
    scenes,
    currentScene,
    marqueeText,
    setMarqueeText,
    bgmMuted,
    logs,
    overlayItems,
    dragging,
    canvasRef,
    logsEndRef,
    handleConnect,
    handleSceneSwitch,
    handleEmergencyHide,
    handleMarqueeUpdate,
    handleToggleMute,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
  };
}
