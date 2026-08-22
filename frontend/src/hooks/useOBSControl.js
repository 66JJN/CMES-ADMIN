import { useState, useEffect, useRef, useCallback } from "react";
import OBSWebSocket from "obs-websocket-js";
import adminFetch from "../config/authFetch";

export const DEFAULT_OVERLAY_STYLE = Object.freeze({
  preset: "balanced",
  imageFit: "contain",
  verticalPosition: "bottom",
  cardScale: 1,
  imageMaxWidth: 600,
  textScale: 1,
  imageBackgroundStyle: "transparent",
  textBackgroundStyle: "dim",
  giftBackgroundStyle: "dim",
});

const BACKGROUND_STYLES = new Set(["transparent", "dim", "blur"]);
const normalizeOverlayStyle = (value = {}) => {
  const candidate = value && typeof value === "object" ? value : {};
  const legacyBackground = BACKGROUND_STYLES.has(candidate.backgroundStyle)
    ? candidate.backgroundStyle
    : null;
  const pickBackground = (key) => BACKGROUND_STYLES.has(candidate[key])
    ? candidate[key]
    : (legacyBackground || DEFAULT_OVERLAY_STYLE[key]);
  return {
    ...DEFAULT_OVERLAY_STYLE,
    ...candidate,
    imageBackgroundStyle: pickBackground("imageBackgroundStyle"),
    textBackgroundStyle: pickBackground("textBackgroundStyle"),
    giftBackgroundStyle: pickBackground("giftBackgroundStyle"),
  };
};

export const DEFAULT_DISPLAY_PROFILE = Object.freeze({
  id: "main",
  name: "จอหลัก",
  width: 1920,
  height: 1080,
  physicalWidthCm: null,
  viewingDistanceM: null,
  obsSceneName: "",
  enabled: true,
  overlayStyle: DEFAULT_OVERLAY_STYLE,
});

const normalizeDisplayProfile = (value = {}, index = 0, fallbackStyle = DEFAULT_OVERLAY_STYLE) => ({
  ...DEFAULT_DISPLAY_PROFILE,
  ...value,
  id: String(value.id || (index === 0 ? "main" : `display-${index + 1}`)),
  name: String(value.name || (index === 0 ? "จอหลัก" : `จอ ${index + 1}`)),
  overlayStyle: normalizeOverlayStyle(value.overlayStyle || fallbackStyle),
});

const normalizeDisplayProfiles = (profiles, fallbackStyle) => (
  Array.isArray(profiles) && profiles.length
    ? profiles.slice(0, 8).map((profile, index) => normalizeDisplayProfile(profile, index, fallbackStyle))
    : [normalizeDisplayProfile(DEFAULT_DISPLAY_PROFILE, 0, fallbackStyle)]
);

const DISPLAY_TOKEN_RENEWAL_WINDOW_MS = 5 * 60 * 1000;

const decodeJwtExpiryMs = (token) => {
  try {
    const encodedPayload = String(token || "").split(".")[1];
    if (!encodedPayload) return 0;
    const normalized = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    if (typeof window === "undefined" || typeof window.atob !== "function") return 0;
    const json = decodeURIComponent(Array.from(
      window.atob(padded),
      (char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`
    ).join(""));
    return Number(JSON.parse(json).exp || 0) * 1000;
  } catch {
    return 0;
  }
};

export const shouldReuseBrowserSourceUrl = (existingUrl, desiredUrl, nowMs = Date.now()) => {
  try {
    const existing = new URL(existingUrl);
    const desired = new URL(desiredUrl);
    const sameDestination = existing.origin === desired.origin
      && existing.pathname === desired.pathname
      && existing.searchParams.get("shopId") === desired.searchParams.get("shopId")
      && existing.searchParams.get("displayId") === desired.searchParams.get("displayId");
    if (!sameDestination) return false;
    const expiresAt = decodeJwtExpiryMs(existing.searchParams.get("token"));
    return expiresAt > nowMs + DISPLAY_TOKEN_RENEWAL_WINDOW_MS;
  } catch {
    return false;
  }
};

export const publishOBSOperatorState = (socket, connected) => {
  if (!socket || typeof socket.emit !== "function") return;
  socket.emit("set-obs-operator-connected", { connected: Boolean(connected) });
};

export const subscribeOBSOperatorStateSync = (socket, getConnected) => {
  if (!socket || typeof socket.on !== 'function' || typeof socket.off !== 'function') {
    return () => {};
  }
  // A reconnect of the Admin Socket.IO connection does not prove that OBS Web
  // Control disconnected. Publishing a temporary false state here used to
  // pause/recover the real queue while changing pages.
  const publishCurrent = () => {
    if (getConnected?.() === true) publishOBSOperatorState(socket, true);
  };
  socket.on('connect', publishCurrent);
  if (socket.connected) publishCurrent();
  return () => socket.off('connect', publishCurrent);
};

/**
 * Custom Hook for handling OBS Studio WebSocket controls.
 * Manages connection, scenes, audio muting, text inputs, dragging positions,
 * and clears pending timers/listeners to prevent memory leaks.
 */
export default function useOBSControl({ API_BASE_URL, adminId, shopId, adminSocket }) {
  const [url, setUrl] = useState("ws://localhost:4455");
  const [password, setPassword] = useState("");
  const [isConnected, setIsConnected] = useState(false);

  const [scenes, setScenes] = useState([]);
  const [currentScene, setCurrentScene] = useState("");
  const [marqueeText, setMarqueeText] = useState("");
  const [bgmMuted, setBgmMuted] = useState(false);
  const [logs, setLogs] = useState([]);
  const [overlayStyle, setOverlayStyle] = useState(DEFAULT_OVERLAY_STYLE);
  const [isSavingOverlayStyle, setIsSavingOverlayStyle] = useState(false);
  const [displayProfiles, setDisplayProfiles] = useState([DEFAULT_DISPLAY_PROFILE]);
  const [activeDisplayId, setActiveDisplayId] = useState("main");

  const obsRef = useRef(null);
  if (!obsRef.current) {
    obsRef.current = new OBSWebSocket();
  }

  const logsEndRef = useRef(null);
  const canvasRef = useRef(null);
  const draggingRef = useRef(null);
  const timeoutRef = useRef(null); // Ref to track pending connection timers
  const adminSocketRef = useRef(adminSocket);
  const obsConnectedRef = useRef(false);
  const latestObsHandlersRef = useRef({
    fetchInitialData: null,
    fetchSceneItems: null,
  });

  const [overlayItems, setOverlayItems] = useState({});
  const [dragging, setDragging] = useState(null);

  useEffect(() => {
    adminSocketRef.current = adminSocket;
  }, [adminSocket]);

  useEffect(() => subscribeOBSOperatorStateSync(
    adminSocket,
    () => obsConnectedRef.current,
  ), [adminSocket]);

  const addLog = useCallback((msg, type = "info") => {
    setLogs((prev) => [
      ...prev,
      { time: new Date().toLocaleTimeString(), msg, type },
    ]);
  }, []);

  // The template belongs to the shop, not to this browser or OBS instance.
  // Loading it here also makes the controls useful before OBS is connected.
  useEffect(() => {
    if (!shopId) return undefined;
    let cancelled = false;

    const loadOverlayStyle = async () => {
      try {
        const response = await adminFetch(
          `${API_BASE_URL}/api/status?shopId=${encodeURIComponent(shopId)}`
        );
        const config = await response.json();
        if (!cancelled && response.ok) {
          const fallbackStyle = normalizeOverlayStyle(config.overlayStyle);
          const profiles = normalizeDisplayProfiles(config.displayProfiles, fallbackStyle);
          setDisplayProfiles(profiles);
          const activeProfile = profiles.find((profile) => profile.id === "main") || profiles[0];
          setActiveDisplayId(activeProfile.id);
          setOverlayStyle(activeProfile.overlayStyle);
        }
      } catch (error) {
        if (!cancelled) addLog("Unable to load overlay template; using recommended preset", "warning");
      }
    };

    loadOverlayStyle();
    return () => { cancelled = true; };
  }, [API_BASE_URL, shopId, addLog]);

  const activeDisplayProfile = displayProfiles.find((profile) => profile.id === activeDisplayId)
    || displayProfiles[0]
    || DEFAULT_DISPLAY_PROFILE;

  const selectDisplayProfile = useCallback((displayId) => {
    const selected = displayProfiles.find((profile) => profile.id === displayId);
    if (!selected) return;
    setActiveDisplayId(selected.id);
    setOverlayStyle(normalizeOverlayStyle(selected.overlayStyle));
  }, [displayProfiles]);

  const updateActiveDisplayProfile = useCallback((changes) => {
    const nextOverlayStyle = changes.overlayStyle ? normalizeOverlayStyle(changes.overlayStyle) : null;
    if (nextOverlayStyle) setOverlayStyle(nextOverlayStyle);
    setDisplayProfiles((previous) => previous.map((profile) => {
      if (profile.id !== activeDisplayId) return profile;
      const next = { ...profile, ...changes };
      if (nextOverlayStyle) next.overlayStyle = nextOverlayStyle;
      return next;
    }));
  }, [activeDisplayId]);

  const addDisplayProfile = useCallback(() => {
    if (displayProfiles.length >= 8) return;
    const id = `display-${Date.now().toString(36)}`;
    const profile = normalizeDisplayProfile({
      id,
      name: `จอ ${displayProfiles.length + 1}`,
      overlayStyle,
    }, displayProfiles.length, overlayStyle);
    setActiveDisplayId(id);
    setDisplayProfiles((previous) => {
      return [...previous, profile];
    });
  }, [displayProfiles.length, overlayStyle]);

  const removeActiveDisplayProfile = useCallback(() => {
    if (displayProfiles.length <= 1) return;
    const remaining = displayProfiles.filter((profile) => profile.id !== activeDisplayId);
    setDisplayProfiles(remaining);
    setActiveDisplayId(remaining[0].id);
    setOverlayStyle(normalizeOverlayStyle(remaining[0].overlayStyle));
  }, [displayProfiles, activeDisplayId]);

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
  const autoCreateRequiredSources = useCallback(async (obs, sceneName, displayProfile = DEFAULT_DISPLAY_PROFILE) => {
    try {
      addLog(`🔍 ตรวจสอบโครงสร้างพื้นฐานใน Scene: ${sceneName}...`, "info");

      const { sceneItems } = await obs.call("GetSceneItemList", { sceneName });
      const existingSourceNames = sceneItems.map((item) => item.sourceName);
      const targetShopId = shopId || adminId;
      const displayToken = await getDisplayToken();
      const displayQuery = `shopId=${encodeURIComponent(targetShopId)}&displayId=${encodeURIComponent(displayProfile.id)}&token=${encodeURIComponent(displayToken)}`;
      const sourceWidth = Number(displayProfile.width) || 1920;
      const sourceHeight = Number(displayProfile.height) || 1080;

      const ensureBrowserSource = async (inputName, url, width = 1920, height = 1080) => {
        if (existingSourceNames.includes(inputName)) {
          const { inputSettings = {} } = await obs.call("GetInputSettings", { inputName });
          const reusableUrl = shouldReuseBrowserSourceUrl(inputSettings.url, url);
          const dimensionsChanged = Number(inputSettings.width) !== Number(width)
            || Number(inputSettings.height) !== Number(height);
          if (!reusableUrl || dimensionsChanged) {
            await obs.call("SetInputSettings", {
              inputName,
              inputSettings: {
                url: reusableUrl ? inputSettings.url : url,
                width,
                height,
              },
              overlay: true,
            });
            addLog(
              reusableUrl
                ? `📐 Updated '${inputName}' display size without reloading it`
                : `🔄 Updated '${inputName}' with a fresh secure display link`,
              "success"
            );
          }
          return;
        }

        addLog(`⏳ Creating '${inputName}'...`, "warning");
        await obs.call("CreateInput", {
          sceneName,
          inputName,
          inputKind: "browser_source",
          inputSettings: { url, width, height },
        });
        addLog(`✅ Created '${inputName}'`, "success");
      };

      // 1. Each screen profile owns an image/text Browser Source. Main keeps
      // the legacy name so existing OBS scenes continue working untouched.
      const imageSourceName = displayProfile.id === "main"
        ? "Overlay_ImageText"
        : `CMES_${displayProfile.id}_ImageText`;
      await ensureBrowserSource(imageSourceName, `${API_BASE_URL}/obs-image-overlay.html?${displayQuery}`, sourceWidth, sourceHeight);

      // Ranking and lucky wheel remain global presentation sources for now.
      // They are created only in the main display scene, avoiding duplicated
      // wheel/ranking panels across every physical output.
      if (displayProfile.id === "main") {
        await ensureBrowserSource("Overlay_Ranking", `${API_BASE_URL}/obs-ranking-overlay.html?${displayQuery}`);
        await ensureBrowserSource("Overlay_LuckyWheel", `${API_BASE_URL}/obs-lucky-wheel.html?${displayQuery}`);
      }

      // 2. Marquee Text Source
      if (displayProfile.id === "main" && !existingSourceNames.includes("MarqueeText")) {
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
      if (displayProfile.id === "main" && !existingSourceNames.includes("BGM")) {
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
  const fetchInitialData = useCallback(async (profilesOverride) => {
    const obs = obsRef.current;
    try {
      const sceneList = await obs.call("GetSceneList");
      const currentProgramScene = sceneList.currentProgramSceneName;
      setScenes(sceneList.scenes.map((s) => s.sceneName).reverse());
      setCurrentScene(currentProgramScene);

      if (currentProgramScene) {
        const sceneNames = new Set(sceneList.scenes.map((scene) => scene.sceneName));
        const profilesToSync = (profilesOverride || displayProfiles).filter((profile) => profile.enabled !== false);
        for (const profile of profilesToSync) {
          // Only the legacy main profile may use the active Scene implicitly.
          // Extra outputs must be mapped deliberately, otherwise two Browser
          // Sources would be stacked on the same program output by accident.
          if (profile.id !== "main" && !profile.obsSceneName) {
            addLog(`ยังไม่ได้ผูก Scene ให้ ${profile.name} — ยังไม่สร้าง Source`, "warning");
            continue;
          }
          const targetScene = profile.obsSceneName && sceneNames.has(profile.obsSceneName)
            ? profile.obsSceneName
            : currentProgramScene;
          await autoCreateRequiredSources(obs, targetScene, profile);
        }
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
  }, [autoCreateRequiredSources, fetchSceneItems, addLog, displayProfiles]);

  // Keep event listeners for the whole Dashboard lifetime. The OBS panel is a
  // modal, so closing it must not silently disconnect a live operator session.
  // Refs let those persistent listeners call the newest profile/scene logic.
  useEffect(() => {
    latestObsHandlersRef.current = { fetchInitialData, fetchSceneItems };
  }, [fetchInitialData, fetchSceneItems]);

  // Setup WS listeners once; disconnect only when the Dashboard itself unmounts
  // (logout/navigation), never when the control modal is closed or settings change.
  useEffect(() => {
    const obs = obsRef.current;

    const onConnect = () => {
      obsConnectedRef.current = true;
      setIsConnected(true);
      publishOBSOperatorState(adminSocketRef.current, true);
      addLog("🟢 Connected to OBS Studio successfully", "success");
      
      // Cleanup previous timeout if existing
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      // Add safety timer to fetch initial settings after web socket initializes
      timeoutRef.current = setTimeout(() => {
        latestObsHandlersRef.current.fetchInitialData?.();
      }, 500);
    };

    const onDisconnect = () => {
      obsConnectedRef.current = false;
      setIsConnected(false);
      publishOBSOperatorState(adminSocketRef.current, false);
      addLog("🔴 Disconnected from OBS Studio", "error");
    };

    const onSceneChanged = (data) => {
      setCurrentScene(data.sceneName);
      addLog(`📺 Scene switched to: ${data.sceneName}`, "info");
      latestObsHandlersRef.current.fetchSceneItems?.(obs, data.sceneName);
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
  // Profile-aware callbacks are read through refs above, so this effect only
  // cleans up when the Dashboard itself unmounts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Connect/Disconnect controls
  const handleConnect = useCallback(async () => {
    if (isConnected) {
      try {
        publishOBSOperatorState(adminSocketRef.current, false);
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
      publishOBSOperatorState(adminSocketRef.current, false);
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

  const saveDisplayProfiles = useCallback(async () => {
    const normalized = normalizeOverlayStyle(activeDisplayProfile.overlayStyle || overlayStyle);
    const profilesToSave = displayProfiles.map((profile) => (
      profile.id === activeDisplayProfile.id
        ? { ...profile, overlayStyle: normalized }
        : profile
    ));
    setOverlayStyle(normalized);
    setDisplayProfiles(profilesToSave);
    setIsSavingOverlayStyle(true);
    try {
      const response = await adminFetch(`${API_BASE_URL}/api/config/update`, {
        method: "POST",
        body: JSON.stringify({ overlayStyle: normalized, displayProfiles: profilesToSave }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to save overlay template");
      }
      const savedProfiles = normalizeDisplayProfiles(data.config?.displayProfiles, data.config?.overlayStyle);
      const savedActive = savedProfiles.find((profile) => profile.id === activeDisplayProfile.id) || savedProfiles[0];
      setDisplayProfiles(savedProfiles);
      setActiveDisplayId(savedActive.id);
      setOverlayStyle(normalizeOverlayStyle(savedActive.overlayStyle));
      if (isConnected) await fetchInitialData(savedProfiles);
      addLog("บันทึกโปรไฟล์จอและรูปแบบ Overlay แล้ว", "success");
      return true;
    } catch (error) {
      addLog(`Overlay template was not saved: ${error.message}`, "error");
      return false;
    } finally {
      setIsSavingOverlayStyle(false);
    }
  }, [API_BASE_URL, activeDisplayProfile, addLog, displayProfiles, fetchInitialData, isConnected, overlayStyle]);

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
    overlayStyle,
    setOverlayStyle,
    isSavingOverlayStyle,
    saveDisplayProfiles,
    displayProfiles,
    activeDisplayProfile,
    activeDisplayId,
    selectDisplayProfile,
    updateActiveDisplayProfile,
    addDisplayProfile,
    removeActiveDisplayProfile,
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
