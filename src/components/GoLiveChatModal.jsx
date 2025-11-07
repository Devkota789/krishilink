import React, { useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";

const SIGNALR_URL =
  "https://w1vqqn7ucvzpndp9xsvdkd15gzcedswvilahs3agd6b3dljo7tg24pbklk4u.shamir.com.np/chatHub";
const HISTORY_URL =
  "https://w1vqqn7ucvzpndp9xsvdkd15gzcedswvilahs3agd6b3dljo7tg24pbklk4u.shamir.com.np/api/Chat/getChatHistory/";
// OPTIONAL: Replace with real endpoint (POST) that marks user offline / closes previous connection server-side.
const DISCONNECT_URL =
  "https://w1vqqn7ucvzpndp9xsvdkd15gzcedswvilahs3agd6b3dljo7tg24pbklk4u.shamir.com.np/api/Chat/markOffline";

// Full screen layout styles
const overlayStyle = {
  position: "fixed",
  inset: 0,
  width: "100vw",
  height: "100vh",
  background: "#f5f7f6",
  zIndex: 3000,
  display: "flex",
  flexDirection: "column",
  fontFamily: "Inter, system-ui, sans-serif",
};
const headerStyle = {
  height: 64,
  background: "linear-gradient(90deg,#2e7d32,#4caf50)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 1.5rem",
  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
};
const layoutStyle = {
  flex: 1,
  display: "flex",
  minHeight: 0,
};
const sideBarStyle = {
  width: 220,
  background: "#ffffff",
  borderRight: "1px solid #e0e5e0",
  display: "flex",
  flexDirection: "column",
  padding: "1rem .85rem 1.2rem",
  gap: ".85rem",
  overflow: "hidden",
};
const chatAreaWrapper = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
};
const chatScroll = {
  flex: 1,
  overflowY: "auto",
  padding: "1.25rem 1.5rem 1.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.9rem",
};
const inputBar = {
  padding: "0.9rem 1rem",
  background: "#ffffff",
  borderTop: "1px solid #e0e5e0",
  display: "flex",
  gap: "0.75rem",
  alignItems: "center",
};

export default function GoLiveChatModal({ open, onClose }) {
  const { user } = useAuth();
  const [token, setToken] = useState(null);
  const tokenRef = useRef(null);
  React.useEffect(() => {
    tokenRef.current = token;
  }, [token]);
  const [fullName, setFullName] = useState("");
  const [userId, setUserId] = useState(null);
  const [receiverId, setReceiverId] = useState("");
  // Keep latest selected receiver in a ref for access inside stable callbacks
  const receiverIdRef = useRef("");
  React.useEffect(() => {
    receiverIdRef.current = receiverId;
  }, [receiverId]);
  const [messages, setMessages] = useState([]);
  // Auto-scroll to bottom when messages update or receiver changes
  React.useEffect(() => {
    if (!messagesDivRef.current) return;
    // Use rAF for smoother scroll after DOM paint
    requestAnimationFrame(() => {
      try {
        messagesDivRef.current.scrollTop = messagesDivRef.current.scrollHeight;
      } catch {}
    });
  }, [messages, receiverId]);
  const [chatInput, setChatInput] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [customers, setCustomers] = useState([]); // buyer ids
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState("");
  const [lastCustomersUpdate, setLastCustomersUpdate] = useState(null); // timestamp of last successful change
  const customersRef = useRef(customers); // always-current customers list
  const customersInFlightRef = useRef(false); // prevent overlapping fetches
  React.useEffect(() => {
    customersRef.current = customers;
  }, [customers]);
  const [userMeta, setUserMeta] = useState({}); // id => { name, image }
  const [isConnected, setIsConnected] = useState(false); // SignalR connection status
  const connectionRef = useRef(null);
  const startingRef = useRef(false); // prevent parallel starts
  const stoppingRef = useRef(false); // prevent start during an in-flight stop
  const messagesDivRef = useRef(null);
  const sessionRef = useRef(null); // logical chat session id (persists across refresh)
  const connectionIdRef = useRef(null); // track hub connection id for server-side cleanup
  const manualCloseRef = useRef(false); // track if farmer explicitly closed chat modal
  // Removed auto-refresh polling per request: customers list now refreshes only manually
  const forcedPrevDisconnectRef = useRef(false); // ensure we only try once per page load
  const customersPollRef = useRef(null); // interval id for 5s polling
  // Keep a ref to userMeta for access inside hub callbacks without stale closure
  const userMetaRef = useRef(userMeta);
  React.useEffect(() => {
    userMetaRef.current = userMeta;
  }, [userMeta]);
  // Persist & restore state
  const PERSIST_KEY = "liveChatPersist_v1";
  const PREV_CONN_KEY = "liveChatPrevConnectionId"; // last known hub connection id for logical resume
  const restoredRef = useRef(false);
  React.useEffect(() => {
    if (!open || restoredRef.current) return;
    try {
      const raw = localStorage.getItem(PERSIST_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && saved.open) {
          if (saved.receiverId) setReceiverId(saved.receiverId);
          if (Array.isArray(saved.messages) && saved.messages.length) {
            setMessages(saved.messages);
          }
        }
      }
    } catch {}
    restoredRef.current = true;
  }, [open]);
  // Save on changes (throttle via simple timeout)
  const saveTimeout = useRef(null);
  const scheduleSave = () => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      try {
        const minimal = messages.slice(-100); // limit size
        localStorage.setItem(
          PERSIST_KEY,
          JSON.stringify({
            open: open === true,
            receiverId,
            messages: minimal,
            ts: Date.now(),
          })
        );
      } catch {}
    }, 300);
  };
  React.useEffect(() => {
    if (open) scheduleSave();
  }, [open, receiverId, messages]);
  // Cleanup on unmount
  React.useEffect(
    () => () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    },
    []
  );
  // Keep connection alive when tab is hidden or page is minimized; only notify server on full unload.
  React.useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        const uid = userId || user?.id || user?.userId;
        if (uid && connectionIdRef.current && token) {
          const payload = JSON.stringify({
            userId: uid,
            connectionId: connectionIdRef.current,
            sessionId: sessionRef.current,
            reason: "beforeunload",
            ts: Date.now(),
          });
          navigator.sendBeacon?.(
            DISCONNECT_URL,
            new Blob([payload], { type: "application/json" })
          );
        }
      } catch {}
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [token, userId, user]);

  // Load SignalR if not present
  React.useEffect(() => {
    if (!window.signalR) {
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/@microsoft/signalr@7.0.5/dist/browser/signalr.min.js";
      document.body.appendChild(script);
    }
  }, []);

  // Graceful disconnect helper
  const gracefulDisconnect = async (reason = "manual") => {
    const hub = connectionRef.current;
    if (!hub) return;
    try {
      await hub.invoke?.("Disconnect", { reason, ts: Date.now() });
    } catch {}
    try {
      await hub.stop();
    } catch {}
  };

  React.useEffect(() => {
    // When farmer clicks Go Live (open === true), capture auth + start connection immediately
    if (open) {
      manualCloseRef.current = false; // reset manual close flag when reopened
      const t =
        (typeof sessionStorage !== "undefined" &&
          sessionStorage.getItem("authToken")) ||
        localStorage.getItem("authToken");
      setToken(t || null);
      setFullName(user?.fullName || user?.name || "Farmer");
      setUserId(user?.id || user?.userId || null);
      setReceiverId("");
      setMessages([]);
      setChatInput("");
      if (t) {
        fetchCustomers(t);
      } else {
        setMessages([
          {
            sender: "System",
            text: "You must be logged in to go live. Please login again.",
            isOwn: false,
          },
        ]);
      }
    } else {
      // Modal closed -> stop and cleanup connection
      if (connectionRef.current) gracefulDisconnect("modal_close");
    }
  }, [open, user]);

  // Start 5-second polling of customers list while modal is open (and token available); stops on close/unmount
  React.useEffect(() => {
    if (open && token) {
      // ensure immediate refresh (in case token just arrived later)
      fetchCustomers(token);
      if (customersPollRef.current) clearInterval(customersPollRef.current);
      customersPollRef.current = setInterval(() => {
        const t =
          tokenRef.current ||
          (typeof sessionStorage !== "undefined" &&
            sessionStorage.getItem("authToken")) ||
          localStorage.getItem("authToken");
        if (!t) return;
        // Avoid overlapping requests; fetchCustomers already guards via customersLoading
        fetchCustomers(t);
      }, 5000);
    } else if (!open && customersPollRef.current) {
      clearInterval(customersPollRef.current);
      customersPollRef.current = null;
    }
    return () => {
      if (customersPollRef.current) {
        clearInterval(customersPollRef.current);
        customersPollRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, token]);

  // Fetch customers (buyers) list
  const fetchCustomers = async (tkn) => {
    if (customersInFlightRef.current) return; // avoid overlap
    customersInFlightRef.current = true;
    console.debug("[Chat] fetchCustomers start", {
      tknExists: !!tkn,
      connectionState: connectionRef.current?.state,
    });
    setCustomersLoading(true);
    setCustomersError("");
    try {
      const res = await fetch(
        "https://w1vqqn7ucvzpndp9xsvdkd15gzcedswvilahs3agd6b3dljo7tg24pbklk4u.shamir.com.np/api/Chat/getMyCustomersForChat",
        { headers: { Authorization: `Bearer ${tkn}` } }
      );
      if (res.status === 404) {
        // Treat 404 as no customers available
        if (customersRef.current.length !== 0) {
          setCustomers([]);
          setLastCustomersUpdate(Date.now());
        }
        setCustomersLoading(false);
        customersInFlightRef.current = false;
        return;
      }
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const ct = res.headers.get("content-type") || "";
      let body;
      try {
        body = ct.includes("application/json")
          ? await res.json()
          : await res.text();
      } catch (e) {
        console.warn("Failed to parse customers response", e);
      }
      let ids = [];
      if (Array.isArray(body)) {
        ids = body.filter((v) => typeof v === "string" && v);
      } else if (body && Array.isArray(body.data)) {
        ids = body.data.filter((v) => typeof v === "string" && v);
      }
      console.debug("Customers API raw body", body, "parsed IDs", ids);
      // Deduplicate & stable sort for consistent ordering
      ids = [...new Set(ids)].sort();
      // Only update state if changed to avoid unnecessary re-render flicker every 5s
      const prev = customersRef.current;
      const changed =
        ids.length !== prev.length || ids.some((id, i) => id !== prev[i]);
      if (changed) {
        setCustomers(ids);
        setLastCustomersUpdate(Date.now());
        ids.slice(0, 15).forEach((id) => ensureUserMeta(id, tkn));
      }
    } catch (e) {
      setCustomersError(e.message || "Unable to load customers");
    }
    setCustomersLoading(false);
    customersInFlightRef.current = false;
    console.debug("[Chat] fetchCustomers end", { count: customers.length });
  };

  // Keep connection alive / restart if unexpectedly closed
  const ensureConnection = async () => {
    if (!token || !userId) return;
    const hub = connectionRef.current;
    const desiredState = window.signalR?.HubConnectionState?.Connected;
    try {
      if (!hub || hub.state !== desiredState) {
        console.debug("[Chat] ensureConnection: (re)starting", {
          hasHub: !!hub,
          state: hub?.state,
        });
        await startSignalR(token, userId);
      }
    } catch (e) {
      console.warn("[Chat] ensureConnection failed", e);
    }
  };

  const ensureUserMeta = async (id, tkn = token) => {
    if (!id || userMeta[id]) return;
    const meta = {};
    try {
      const nameRes = await fetch(
        `https://w1vqqn7ucvzpndp9xsvdkd15gzcedswvilahs3agd6b3dljo7tg24pbklk4u.shamir.com.np/api/User/getUserNameById/${id}`,
        { headers: { Authorization: `Bearer ${tkn}` } }
      );
      if (nameRes.ok) {
        const ct = nameRes.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          try {
            const json = await nameRes.json();
            if (json && typeof json.data === "string") {
              meta.name = json.data.trim();
            } else if (typeof json === "string") {
              meta.name = json.trim();
            }
          } catch (e) {
            // fallback to text
            try {
              const fallbackTxt = await nameRes.text();
              meta.name = (fallbackTxt || "")
                .replace(/^['"]|['"]$/g, "")
                .trim();
            } catch {}
          }
        } else {
          const txt = await nameRes.text();
          meta.name = (txt || "").replace(/^['"]|['"]$/g, "").trim();
        }
      }
    } catch {}
    try {
      const imgRes = await fetch(
        `https://w1vqqn7ucvzpndp9xsvdkd15gzcedswvilahs3agd6b3dljo7tg24pbklk4u.shamir.com.np/api/User/getUserImageById/${id}`,
        { headers: { Authorization: `Bearer ${tkn}` } }
      );
      if (imgRes.ok) {
        const ct = imgRes.headers.get("content-type") || "";
        if (ct.startsWith("image/")) {
          const blob = await imgRes.blob();
          meta.image = URL.createObjectURL(blob);
        } else {
          const txt = await imgRes.text();
          if (/^data:image\//.test(txt) || /^https?:\/\//.test(txt))
            meta.image = txt.trim();
        }
      }
    } catch {}
    setUserMeta((prev) => ({ ...prev, [id]: meta }));
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("");
  };

  const handleLoadHistory = async (rid = receiverId) => {
    if (!rid) {
      setMessages((msgs) => [
        ...msgs,
        {
          sender: "System",
          text: "Please enter a receiver user id.",
          isOwn: false,
        },
      ]);
      return;
    }
    setHistoryLoading(true);
    setMessages([
      { sender: "System", text: "Loading chat history...", isOwn: false },
    ]);
    try {
      const res = await fetch(HISTORY_URL + rid, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load history");
      const ct = res.headers.get("content-type") || "";
      let raw = ct.includes("application/json")
        ? await res.json()
        : await res.text();
      let items = [];
      if (Array.isArray(raw)) items = raw;
      else if (raw && Array.isArray(raw.data)) items = raw.data;
      if (!Array.isArray(items)) items = [];
      // Optional sort if server provides timestamp
      items.sort((a, b) => {
        const ta = new Date(
          a.sentAt || a.createdAt || a.timestamp || 0
        ).getTime();
        const tb = new Date(
          b.sentAt || b.createdAt || b.timestamp || 0
        ).getTime();
        return ta - tb;
      });
      if (items.length === 0) {
        setMessages([
          { sender: "System", text: "No chat history.", isOwn: false },
        ]);
      } else {
        const mapped = items.map((h) => {
          const sid =
            h.senderId ||
            h.senderUserId ||
            h.fromId ||
            h.fromUserId ||
            h.userId ||
            h.creatorId;
          const ridField =
            h.receiverId || h.receiverUserId || h.toId || h.toUserId;
          const isOwn = sid && sid === userId;
          // Try to infer name
          const inferredName = isOwn
            ? fullName || "You"
            : h.senderName ||
              h.fromName ||
              (sid && userMetaRef.current[sid]?.name) ||
              (sid === rid ? userMetaRef.current[rid]?.name : "") ||
              "Unknown";
          // If we still don't have meta for this sender, queue fetch
          if (sid && sid !== userId && !userMetaRef.current[sid]) {
            ensureUserMeta(sid);
          }
          return {
            senderId: sid,
            receiverId: ridField,
            sender: inferredName,
            text: h.message || h.text || h.body || h.content || "",
            isOwn,
          };
        });
        setMessages(mapped);
      }
    } catch (e) {
      setMessages([
        {
          sender: "System",
          text: e.message || "Error loading history",
          isOwn: false,
        },
      ]);
    }
    setHistoryLoading(false);
    // Scroll after a tick
    setTimeout(() => {
      if (messagesDivRef.current) {
        messagesDivRef.current.scrollTop = messagesDivRef.current.scrollHeight;
      }
    }, 50);
  };
  // Force-disconnect (server-side) any lingering connection BEFORE starting a new one (covers fast successive refreshes)
  const forceDisconnectPrevious = async (activeToken, activeUserId) => {
    try {
      const prevRaw = localStorage.getItem("lastChatConnectionInfo");
      if (prevRaw) {
        const prev = JSON.parse(prevRaw);
        if (prev?.connectionId) {
          await fetch(DISCONNECT_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${activeToken}`,
            },
            body: JSON.stringify({
              userId: activeUserId,
              connectionId: prev.connectionId,
              sessionId: prev.sessionId,
              reason: "pre_start_force_replace",
              ts: Date.now(),
            }),
            keepalive: true,
          }).catch(() => {});
        }
      }
    } catch (e) {
      console.warn("[Chat] forceDisconnectPrevious failed", e);
    }
  };

  const startSignalR = async (
    explicitToken = token,
    explicitUserId = userId
  ) => {
    if (startingRef.current || stoppingRef.current) return;
    const activeToken =
      explicitToken ||
      (typeof sessionStorage !== "undefined" &&
        sessionStorage.getItem("authToken")) ||
      localStorage.getItem("authToken");
    const activeUserId = explicitUserId || user?.id || user?.userId;
    if (!activeToken || !activeUserId || connectionRef.current) return;
    if (!window.signalR?.HubConnectionBuilder) {
      setMessages((m) => [
        ...m,
        {
          sender: "System",
          text: "SignalR library not loaded yet.",
          isOwn: false,
        },
      ]);
      return;
    }
    startingRef.current = true;
    if (!forcedPrevDisconnectRef.current) {
      forcedPrevDisconnectRef.current = true;
      await forceDisconnectPrevious(activeToken, activeUserId);
    }
    // Restore or generate logical session id (permits server to link pre/post refresh)
    if (!sessionRef.current) {
      try {
        sessionRef.current =
          localStorage.getItem("liveChatSessionId") ||
          (self.crypto?.randomUUID
            ? self.crypto.randomUUID()
            : "s_" + Date.now());
        localStorage.setItem("liveChatSessionId", sessionRef.current);
      } catch {
        sessionRef.current = "s_" + Date.now();
      }
    }
    let resumeParams = "";
    try {
      const prevCid = localStorage.getItem(PREV_CONN_KEY);
      if (prevCid) {
        resumeParams = `&previousConnectionId=${encodeURIComponent(
          prevCid
        )}&resume=1`;
      }
    } catch {}
    const urlWithSession = `${SIGNALR_URL}?sessionId=${encodeURIComponent(
      sessionRef.current
    )}&forceReplace=1${resumeParams}&_=${Date.now()}`; // include previousConnectionId so server may reuse row
    // If a previous global connection object exists (stale after hot-reload/refocus), stop it first
    if (
      window.__farmerChatConnection &&
      window.__farmerChatConnection !== connectionRef.current
    ) {
      try {
        window.__farmerChatConnection.stop();
      } catch {}
    }
    const connection = new window.signalR.HubConnectionBuilder()
      .withUrl(urlWithSession, { accessTokenFactory: () => activeToken })
      .withAutomaticReconnect()
      .build();
    connection.on("ReceiveMessage", (...args) => {
      // Backend signature updated to: (senderUserId, senderFullName, message)
      let senderId, senderName, message;
      if (args.length === 3) [senderId, senderName, message] = args;
      else if (args.length === 2) [senderId, message] = args; // fallback
      else return;
      const isOwn = senderId === activeUserId;
      // SHOW ONLY if: we are in that chat OR it's our own sent echo (rare) – avoid global display when no chat open
      const activeReceiver = receiverIdRef.current;
      if (!isOwn) {
        // If no chat open or different buyer selected, skip displaying in current messages pane
        if (!activeReceiver || String(activeReceiver) !== String(senderId)) {
          // Optionally: could increment an unread counter here in future.
          return;
        }
      }
      if (!senderName) {
        senderName = isOwn
          ? fullName || "You"
          : userMetaRef.current[senderId]?.name || "Unknown";
      }
      if (!isOwn && !userMetaRef.current[senderId]) {
        ensureUserMeta(senderId, activeToken);
      }
      setMessages((prev) => [
        ...prev,
        {
          sender: isOwn ? fullName || "You" : senderName,
          text: message,
          isOwn,
        },
      ]);
    });
    connection.onreconnecting(() => {
      setMessages((prev) => [
        ...prev,
        { sender: "System", text: "Reconnecting...", isOwn: false },
      ]);
    });
    connection.onreconnected((newCid) => {
      setMessages((prev) => [
        ...prev,
        { sender: "System", text: "Reconnected", isOwn: false },
      ]);
      setIsConnected(true);
      if (newCid) {
        connectionIdRef.current = newCid;
        try {
          localStorage.setItem(PREV_CONN_KEY, newCid);
        } catch {}
      }
    });
    try {
      // Double-check: if a stop is happening, wait a tick
      if (stoppingRef.current) {
        await new Promise((r) => setTimeout(r, 120));
      }
      await connection.start();
      console.log("SignalR connected", {
        connectionId: connection.connectionId,
        resumeAttempted: !!resumeParams,
      });
      setIsConnected(true);
      connectionIdRef.current = connection.connectionId;
      try {
        localStorage.setItem(PREV_CONN_KEY, connection.connectionId || "");
      } catch {}
      window.__farmerChatConnection = connection;
      // Post-connect cleanup of any stale previous connectionId (authorized) as fallback
      try {
        const prevInfoRaw = localStorage.getItem("lastChatConnectionInfo");
        if (prevInfoRaw) {
          const prevInfo = JSON.parse(prevInfoRaw);
          if (
            prevInfo?.connectionId &&
            prevInfo.connectionId !== connection.connectionId
          ) {
            console.debug("[Chat] post-connect stale cleanup", prevInfo);
            fetch(DISCONNECT_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${activeToken}`,
              },
              body: JSON.stringify({
                userId: activeUserId,
                connectionId: prevInfo.connectionId,
                sessionId: prevInfo.sessionId,
                replacementConnectionId: connection.connectionId,
                reason: "post_connect_cleanup",
                ts: Date.now(),
              }),
            }).catch(() => {});
          }
        }
      } catch (e) {
        console.warn("[Chat] post-connect cleanup failed", e);
      }
      try {
        localStorage.setItem(
          "lastChatConnectionInfo",
          JSON.stringify({
            connectionId: connection.connectionId,
            sessionId: sessionRef.current,
            ts: Date.now(),
          })
        );
      } catch {}
    } catch (e) {
      console.error("SignalR connection failed", e);
      setMessages((prev) => [
        ...prev,
        { sender: "System", text: "Failed to connect SignalR", isOwn: false },
      ]);
    }
    connectionRef.current = connection;
    startingRef.current = false;
    connection.onclose((err) => {
      console.warn("[Chat] connection closed", {
        error: err?.message,
        connectionId: connectionIdRef.current,
      });
      setIsConnected(false);
      connectionRef.current = null;
      startingRef.current = false;
      connectionIdRef.current = null;
    });
  };

  React.useEffect(() => {
    if (
      open &&
      token &&
      userId &&
      !connectionRef.current &&
      window.signalR?.HubConnectionBuilder
    ) {
      startSignalR(token, userId);
    }
  }, [open, token, userId]);

  // Keepalive / auto-reconnect loop: attempts to reconnect if connection drops while modal is still open and user didn't manually close
  React.useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      if (!open) return; // extra guard
      if (manualCloseRef.current) return; // user intentionally closed earlier
      const hub = connectionRef.current;
      const connectedState = window.signalR?.HubConnectionState?.Connected;
      if (!hub || hub.state !== connectedState) {
        if (token && userId && window.signalR?.HubConnectionBuilder) {
          startSignalR(token, userId);
        }
      }
    }, 8000); // every 8 seconds
    return () => clearInterval(interval);
  }, [open, token, userId]);

  // Heartbeat ping to avoid idle timeouts on some infrastructures
  React.useEffect(() => {
    if (!open) return;
    const hb = setInterval(() => {
      const hub = connectionRef.current;
      const connectedState = window.signalR?.HubConnectionState?.Connected;
      if (hub && hub.state === connectedState) {
        try {
          hub.invoke?.("Ping", { ts: Date.now() });
        } catch {}
      }
    }, 25000); // 25s heartbeat
    return () => clearInterval(hb);
  }, [open]);

  const handleSend = async () => {
    if (!chatInput.trim() || !receiverId) return;
    if (!connectionRef.current) await startSignalR();
    try {
      // Hub method signature: SendMessage(string receiverUserId, string message)
      await connectionRef.current.invoke(
        "SendMessage",
        receiverId,
        chatInput.trim()
      );
      setMessages((prev) => [
        ...prev,
        { sender: fullName || userId, text: chatInput.trim(), isOwn: true },
      ]);
      setChatInput("");
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { sender: "System", text: "Failed to send message", isOwn: false },
      ]);
    }
  };

  const handleLogout = () => {
    manualCloseRef.current = true; // prevent auto-reconnect after explicit close
    if (connectionRef.current) connectionRef.current.stop();
    // optionally also invoke server side disconnect
    gracefulDisconnect("close_button");
    onClose();
  };
  if (!open) return null;
  return (
    <div style={overlayStyle}>
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 26 }}>🟢</span>
          <h1 style={{ fontSize: 22, margin: 0, letterSpacing: 0.5 }}>
            Live Chat
          </h1>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "#ffffff",
            color: "#2e7d32",
            border: "none",
            width: 44,
            height: 44,
            borderRadius: "50%",
            fontSize: 24,
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
          }}
          title="Close"
        >
          ×
        </button>
      </div>
      <div style={layoutStyle}>
        <div style={sideBarStyle}>
          {isConnected && (
            <div
              style={{
                background: "#e8f5e9",
                border: "1px solid #a5d6a7",
                color: "#1b5e20",
                padding: "6px 10px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ fontSize: 10 }}>●</span> Connected to Chat
            </div>
          )}
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#2e7d32",
              textTransform: "uppercase",
              letterSpacing: ".5px",
            }}
          >
            Customers
          </div>
          {lastCustomersUpdate && (
            <div
              style={{
                fontSize: 10,
                color: "#6a876a",
                marginTop: -4,
                marginBottom: 4,
              }}
            >
              Updated {new Date(lastCustomersUpdate).toLocaleTimeString()}
            </div>
          )}
          <button
            onClick={() => {
              ensureConnection();
              const t =
                token ||
                (typeof sessionStorage !== "undefined" &&
                  sessionStorage.getItem("authToken")) ||
                localStorage.getItem("authToken");
              if (t) fetchCustomers(t);
            }}
            style={{
              background: "#eef7ee",
              border: "1px solid #c5e1c5",
              color: "#2e7d32",
              padding: "4px 8px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              cursor: customersLoading ? "wait" : "pointer",
              marginBottom: 6,
              alignSelf: "flex-start",
            }}
            disabled={customersLoading}
          >
            {/* Always show constant label per requirement (hide 'Refreshing...') */}
            Refresh
          </button>
          {!token && (
            <div
              style={{
                fontSize: 12,
                color: "#c62828",
                background: "#ffebee",
                padding: "6px 8px",
                borderRadius: 6,
              }}
            >
              Auth token missing. Please re-login.
            </div>
          )}
          {/* Removed per requirement: avoid showing transient 'Loading customers…' during periodic refreshes. If needed only for first load, condition could be: customersLoading && customers.length===0 */}
          {customersError && !/^Failed \(404\)/.test(customersError) && (
            <div style={{ fontSize: 12, color: "#c62828" }}>
              {customersError}
            </div>
          )}
          {!customersLoading && !customersError && customers.length === 0 && (
            <div style={{ fontSize: 12, color: "#6a876a" }}>
              No customers yet.
            </div>
          )}
          <div
            style={{
              overflowY: "auto",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              paddingRight: 4,
            }}
          >
            {customers.map((cid) => {
              const meta = userMeta[cid] || {};
              if (!meta.name) ensureUserMeta(cid);
              const selected = receiverId === cid;
              return (
                <button
                  key={cid}
                  onClick={() => {
                    setReceiverId(cid);
                    handleLoadHistory(cid);
                    if (!connectionRef.current && !startingRef.current)
                      startSignalR();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    background: selected
                      ? "linear-gradient(90deg,#2e7d32,#4caf50)"
                      : "#f4f9f4",
                    border: selected
                      ? "1px solid #2e7d32"
                      : "1px solid #d7e5d7",
                    color: selected ? "#fff" : "#2e5030",
                    padding: "8px 10px",
                    borderRadius: 10,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    boxShadow: selected
                      ? "0 2px 8px rgba(46,125,50,0.35)"
                      : "0 1px 3px rgba(0,0,0,0.08)",
                  }}
                  title={meta.name || cid}
                >
                  {meta.image ? (
                    <img
                      src={meta.image}
                      alt={meta.name || cid}
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: "2px solid #cfe7cf",
                        background: "#fff",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: selected ? "#2e7d32" : "#d7e5d7",
                        color: selected ? "#fff" : "#2e5030",
                        fontSize: 14,
                        fontWeight: 700,
                      }}
                    >
                      {getInitials(meta.name) || "?"}
                    </div>
                  )}
                  <span
                    style={{
                      flex: 1,
                      textAlign: "left",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {meta.name || cid}
                  </span>
                </button>
              );
            })}
          </div>
          <div
            style={{
              marginTop: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <button
              onClick={handleLogout}
              style={{
                background: "#ffebee",
                border: "1px solid #ffcdd2",
                color: "#c62828",
                padding: "8px 10px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Close Chat
            </button>
          </div>
        </div>
        <div style={chatAreaWrapper}>
          {receiverId && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 16px 6px",
                background: "#ffffff",
                borderBottom: "1px solid #e0e5e0",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: "#d7e5d7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 600,
                    color: "#2e5030",
                    fontSize: 14,
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  {userMeta[receiverId]?.image ? (
                    <img
                      src={userMeta[receiverId].image}
                      alt={userMeta[receiverId]?.name || receiverId}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    getInitials(userMeta[receiverId]?.name || receiverId)
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#2d332d",
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                    }}
                  >
                    {userMeta[receiverId]?.name || receiverId}
                  </span>
                  <span
                    style={{ fontSize: 11, color: "#6a876a", fontWeight: 500 }}
                  >
                    Active chat
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setReceiverId("");
                  setMessages([
                    {
                      sender: "System",
                      text: "No buyer selected. Choose a customer to view chat history.",
                      isOwn: false,
                    },
                  ]);
                }}
                style={{
                  background: "#ffebee",
                  border: "1px solid #ffcdd2",
                  color: "#c62828",
                  padding: "6px 14px",
                  borderRadius: 24,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                }}
                title="Close this chat"
              >
                ✕ Close
              </button>
            </div>
          )}
          {!receiverId && (
            <div
              style={{
                padding: "14px 18px 0",
                fontSize: 13,
                fontWeight: 500,
                color: "#6a876a",
              }}
            >
              Select a customer from the left to start chatting.
            </div>
          )}
          <div ref={messagesDivRef} style={chatScroll}>
            {messages
              .filter((m) => m.sender !== "System")
              .map((msg, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: msg.isOwn ? "flex-end" : "flex-start",
                    maxWidth: "70%",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#6a876a",
                      padding: "0 4px",
                    }}
                  >
                    {msg.sender === "System"
                      ? "System"
                      : msg.isOwn
                      ? "You"
                      : msg.sender}
                  </div>
                  <div
                    style={{
                      background:
                        msg.sender === "System"
                          ? "#ffebee"
                          : msg.isOwn
                          ? "linear-gradient(90deg,#2e7d32,#4caf50)"
                          : "#ffffff",
                      color: msg.isOwn
                        ? "#fff"
                        : msg.sender === "System"
                        ? "#c62828"
                        : "#2d332d",
                      padding: "10px 14px",
                      borderRadius: msg.isOwn
                        ? "18px 4px 18px 18px"
                        : "4px 18px 18px 18px",
                      fontSize: 14,
                      lineHeight: 1.35,
                      boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
          </div>
          <div style={inputBar}>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type your message..."
              style={{
                flex: 1,
                padding: "12px 16px",
                borderRadius: 28,
                border: "1px solid #cdd8cd",
                fontSize: 15,
                outline: "none",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
            />
            <button
              onClick={handleSend}
              disabled={!chatInput.trim() || !receiverId}
              style={{
                background: "linear-gradient(90deg,#2e7d32,#4caf50)",
                color: "#fff",
                border: "none",
                borderRadius: 30,
                padding: "12px 22px",
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: 0.5,
                cursor:
                  !chatInput.trim() || !receiverId ? "not-allowed" : "pointer",
                boxShadow: "0 2px 8px rgba(46,125,50,0.35)",
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
