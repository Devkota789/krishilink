import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Clean simplified Buyer Chat Page
// Flow: connect hub -> fetch farmerId -> fetch meta (name/image) + history -> send/receive

const API_BASE =
  "https://w1vqqn7ucvzpndp9xsvdkd15gzcedswvilahs3agd6b3dljo7tg24pbklk4u.shamir.com.np";
const HUB_URL = API_BASE + "/chatHub";

const rootStyle = {
  display: "flex",
  flexDirection: "column",
  height: "100vh",
  background: "#f5f7f6",
  fontFamily: "Inter, system-ui, sans-serif",
};
const headerStyle = {
  height: 60,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 16px",
  background: "linear-gradient(90deg,#2e7d32,#4caf50)",
  color: "#fff",
  boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
};
const contentStyle = { flex: 1, display: "flex", minHeight: 0 };
const sideStyle = {
  width: 210,
  background: "#fff",
  borderRight: "1px solid #e1e6e1",
  padding: "14px 12px",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};
const mainStyle = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  padding: 16,
};
const messagesBox = {
  flex: 1,
  overflowY: "auto",
  background: "#fff",
  border: "1px solid #dce3dc",
  borderRadius: 10,
  padding: 14,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};
const inputRow = { display: "flex", gap: 10, marginTop: 12 };

export default function ChatPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { sessionToken, user } = useAuth();
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connectError, setConnectError] = useState(null);
  const [farmerId, setFarmerId] = useState(null);
  const [farmerName, setFarmerName] = useState(null);
  const [farmerImage, setFarmerImage] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const connRef = useRef(null);
  const msgsRef = useRef(null);
  const startingRef = useRef(false);
  const manualCloseRef = useRef(false); // track explicit close

  // Reuse persistent connection (across remounts) via window namespace
  const GLOBAL_CONN_KEY = "__BUYER_CHAT_CONN__";

  // auto scroll
  useEffect(() => {
    if (msgsRef.current)
      msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
  }, [messages]);

  // Helper: clean JSON envelope strings (e.g. {"success":true,...,"data":"Ram Pande"})
  const cleanEnvelope = (raw) => {
    if (!raw || typeof raw !== "string") return raw;
    const trimmed = raw.trim();
    if (!trimmed.startsWith("{") || trimmed.length > 800) return raw; // skip huge objects
    try {
      const obj = JSON.parse(trimmed);
      if (obj && typeof obj === "object") {
        if (typeof obj.data === "string" && obj.data.trim())
          return obj.data.trim();
        if (
          typeof obj.message === "string" &&
          obj.message.trim() &&
          !("data" in obj)
        )
          return obj.message.trim();
      }
    } catch {}
    return raw;
  };

  // connect hub
  useEffect(() => {
    if (!sessionToken) return;
    const ensureLib = (cb) => {
      if (window.signalR) return cb();
      const s = document.createElement("script");
      s.src =
        "https://cdn.jsdelivr.net/npm/@microsoft/signalr@7.0.5/dist/browser/signalr.min.js";
      s.onload = cb;
      document.body.appendChild(s);
    };
    ensureLib(() => {
      let existing = window[GLOBAL_CONN_KEY];
      if (existing) {
        connRef.current = existing;
        attachHandlers(existing, false);
        if (existing.state === "Connected" || existing.state === 1) {
          setConnected(true);
          setConnecting(false);
        } else if (existing.state === "Disconnected" || existing.state === 0) {
          startConnection(existing, false);
        } else {
          setConnecting(true);
        }
        return;
      }
      if (startingRef.current) return;
      startingRef.current = true;
      setConnecting(true);
      setConnectError(null);
      const c = new window.signalR.HubConnectionBuilder()
        .withUrl(HUB_URL, { accessTokenFactory: () => sessionToken || "" })
        .withAutomaticReconnect()
        .build();
      window[GLOBAL_CONN_KEY] = c;
      connRef.current = c;
      attachHandlers(c, true);
      startConnection(c, true);
    });

    function attachHandlers(c, first) {
      // prevent duplicate handler stacking
      try {
        c.off("ReceiveMessage");
      } catch {}
      c.on("ReceiveMessage", (...args) => {
        // Backend (updated): SendAsync("ReceiveMessage", senderUserId, senderFullName, message)
        // Legacy (old): SendAsync("ReceiveMessage", senderName, message)
        let senderId = null;
        let senderName = null;
        let message = null;
        if (args.length === 3) {
          [senderId, senderName, message] = args;
        } else if (args.length === 2) {
          // backwards compatibility (no senderId)
          [senderName, message] = args;
        } else {
          return; // unsupported signature
        }
        const cleaned = cleanEnvelope(message || "");
        if (!cleaned) return;
        const currentUserId = user?.id || user?.userId;
        const isOwn =
          senderId != null && String(senderId) === String(currentUserId);
        const displayName = isOwn
          ? user?.fullName || "You"
          : senderName || farmerName || "Farmer";

        // Optional: merge with an optimistic pending message (same text & sending status)
        setMessages((m) => {
          const idx = m.findIndex(
            (mm) =>
              mm.isOwn && mm.localStatus === "sending" && mm.text === cleaned
          );
          if (isOwn && idx !== -1) {
            const clone = [...m];
            clone[idx] = { ...clone[idx], localStatus: "sent" };
            return clone;
          }
          return [
            ...m,
            {
              id: Date.now() + Math.random(),
              sender: displayName,
              text: cleaned,
              isOwn,
              ts: new Date().toLocaleTimeString(),
            },
          ];
        });
      });
      c.onreconnecting(() => {
        setConnected(false);
        setConnecting(true);
      });
      c.onreconnected(() => {
        setConnected(true);
        setConnecting(false);
      });
      c.onclose(() => {
        if (!manualCloseRef.current) {
          setConnected(false);
          setConnecting(false);
        }
      });
    }
    function startConnection(c, fresh) {
      c.start()
        .then(() => {
          if (manualCloseRef.current) return;
          setConnected(true);
          setConnecting(false);
          startingRef.current = false;
        })
        .catch((err) => {
          if (manualCloseRef.current) return;
          setConnectError(err?.message || String(err));
          setConnecting(false);
          startingRef.current = false;
          setTimeout(() => {
            if (!manualCloseRef.current) startConnection(c, false);
          }, 1500);
        });
    }
    return () => {
      // DO NOT stop unless user explicitly closed
      if (manualCloseRef.current && connRef.current) {
        try {
          connRef.current.stop();
        } catch {}
        window[GLOBAL_CONN_KEY] = null;
      }
    };
  }, [sessionToken]);

  const handleClose = () => {
    manualCloseRef.current = true;
    if (connRef.current) {
      try {
        connRef.current.stop();
      } catch {}
    }
    try {
      window[GLOBAL_CONN_KEY] = null;
    } catch {}
    navigate(-1);
  };

  // fetch farmerId after connected
  useEffect(() => {
    if (!sessionToken || !productId || !connected || farmerId) return;
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/Chat/getFarmerIdByProductId/${encodeURIComponent(
            productId
          )}`,
          { headers: { Authorization: `Bearer ${sessionToken}` } }
        );
        if (!res.ok) throw new Error("Cannot get farmer id");
        let body;
        try {
          body = await res.json();
        } catch {
          body = await res.text();
        }
        let fid = null;
        if (typeof body === "string") fid = body;
        else if (Array.isArray(body) && body.length) fid = body[0];
        else if (body && typeof body === "object") {
          fid =
            body.farmerId ||
            body.userId ||
            body.id ||
            (body.data && body.data.farmerId) ||
            null;
        }
        if (!fid) throw new Error("Farmer offline");
        setFarmerId(fid);
      } catch (e) {
        setHistoryError(e.message || String(e));
      }
    })();
  }, [sessionToken, productId, connected, farmerId]);

  // farmer meta
  useEffect(() => {
    if (!sessionToken || !farmerId) return;
    let cancelled = false;
    (async () => {
      try {
        const nameP = fetch(
          `${API_BASE}/api/User/getUserNameById/${encodeURIComponent(
            farmerId
          )}`,
          { headers: { Authorization: `Bearer ${sessionToken}` } }
        )
          .then(async (r) => {
            if (!r.ok) return null;
            const ct = r.headers.get("content-type") || "";
            if (ct.includes("application/json")) {
              try {
                const j = await r.json();
                if (typeof j === "string") return j;
                if (j && typeof j === "object") {
                  return j.data || j.name || j.userName || j.fullName || null;
                }
              } catch {
                return null;
              }
              return null;
            }
            return await r.text();
          })
          .catch(() => null);
        const imgP = fetch(
          `${API_BASE}/api/User/getUserImageById/${encodeURIComponent(
            farmerId
          )}`,
          { headers: { Authorization: `Bearer ${sessionToken}` } }
        )
          .then(async (r) => {
            if (!r.ok) return null;
            const ct = r.headers.get("content-type") || "";
            if (ct.startsWith("image/")) {
              const b = await r.blob();
              return URL.createObjectURL(b);
            }
            return (await r.text()).trim();
          })
          .catch(() => null);
        const [nm, img] = await Promise.all([nameP, imgP]);
        if (cancelled) return;
        if (nm) {
          const cleanedName = cleanEnvelope(String(nm)).replace(
            /^['"]|['"]$/g,
            ""
          );
          setFarmerName(cleanedName);
        }
        if (img) setFarmerImage(img);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionToken, farmerId]);

  // history
  useEffect(() => {
    if (!sessionToken || !farmerId) return;
    setHistoryLoading(true);
    setHistoryError(null);
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/Chat/getChatHistory/${encodeURIComponent(farmerId)}`,
          { headers: { Authorization: `Bearer ${sessionToken}` } }
        );
        if (!res.ok) throw new Error("Failed to load history");
        let body;
        try {
          body = await res.json();
        } catch {
          body = await res.text();
        }
        let items = Array.isArray(body)
          ? body
          : body && Array.isArray(body.data)
          ? body.data
          : [];
        const uid = user?.id || user?.userId;
        const mapped = items
          .map((x) => {
            const rawText = x.message || x.text || x.body || "";
            const cleanedText = cleanEnvelope(String(rawText));
            return {
              id: x.id || x.messageId || Math.random(),
              sender:
                x.senderName ||
                x.fromName ||
                (String(x.senderId || "") === String(uid)
                  ? user?.fullName || "You"
                  : farmerName || "Farmer"),
              text: cleanedText,
              isOwn: String(x.senderId || x.senderUserId || "") === String(uid),
              ts: x.sentAt || x.timestamp || "",
            };
          })
          .filter((m) => m.text && m.text.trim());
        setMessages(mapped);
      } catch (e) {
        setHistoryError(e.message || String(e));
      }
      setHistoryLoading(false);
    })();
  }, [sessionToken, farmerId]);

  const send = async () => {
    if (!input.trim() || !farmerId || !connRef.current) return;
    const text = input.trim();
    const optimistic = {
      id: Date.now(),
      sender: user?.fullName || "You",
      text: cleanEnvelope(text),
      isOwn: true,
      ts: new Date().toLocaleTimeString(),
      localStatus: "sending",
    };
    setMessages((m) => [...m, optimistic]);
    setInput("");
    try {
      await connRef.current.invoke("SendMessage", String(farmerId), text);
      setMessages((m) =>
        m.map((mm) =>
          mm.id === optimistic.id ? { ...mm, localStatus: "sent" } : mm
        )
      );
    } catch {
      setMessages((m) =>
        m.map((mm) =>
          mm.id === optimistic.id ? { ...mm, localStatus: "error" } : mm
        )
      );
    }
  };

  const badge = connected
    ? { label: "Connected", color: "#4caf50" }
    : connecting
    ? { label: "Connecting...", color: "#ff9800" }
    : { label: "Disconnected", color: "#c62828" };
  const farmerInitial = farmerName
    ? farmerName
        .split(/\s+/)
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : farmerId
    ? String(farmerId)[0]
    : "?";

  return (
    <div style={rootStyle}>
      <header style={headerStyle}>
        <h3 style={{ margin: 0, fontWeight: 600 }}>Live Chat</h3>
        <button
          onClick={handleClose}
          style={{
            background: "#fff",
            border: "none",
            borderRadius: 24,
            padding: "6px 14px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Close
        </button>
      </header>
      <div style={contentStyle}>
        <aside style={sideStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 10,
                background: badge.color,
                display: "inline-block",
              }}
            />
            <span>{badge.label}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {farmerImage ? (
              <img
                src={farmerImage}
                alt="farmer"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 10,
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 10,
                  background: "#eef2ee",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  fontWeight: 600,
                  color: "#2e7d32",
                }}
              >
                {farmerInitial}
              </div>
            )}
            <div style={{ fontWeight: 600, fontSize: 15 }}>
              {farmerName ||
                (farmerId
                  ? "Farmer " + String(farmerId).slice(0, 6)
                  : "Farmer")}
            </div>
          </div>
          <div style={{ fontSize: 12, color: "#555" }}>
            {historyLoading
              ? "Loading history..."
              : historyError
              ? "Error: " + historyError
              : messages.length
              ? messages.length + " message(s)"
              : "No messages"}
          </div>
          {connectError && (
            <div style={{ fontSize: 11, color: "#c62828" }}>
              Hub error: {connectError}
            </div>
          )}
        </aside>
        <main style={mainStyle}>
          <div ref={msgsRef} style={messagesBox}>
            {!connected && messages.length === 0 && (
              <div style={{ textAlign: "center", color: "#666" }}>
                Connecting...
              </div>
            )}
            {messages.map((m) => {
              const mine = m.isOwn;
              const farmerAvatar = (
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: "#eef2ee",
                    color: "#2e7d32",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {farmerInitial}
                </div>
              );
              return (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    flexDirection: mine ? "row-reverse" : "row",
                    alignItems: "flex-end",
                    gap: 8,
                  }}
                >
                  {!mine && farmerAvatar}
                  <div
                    style={{
                      maxWidth: 360,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div
                      style={{
                        background: mine
                          ? "linear-gradient(90deg,#2e7d32,#4caf50)"
                          : "#fff",
                        color: mine ? "#fff" : "#2d332d",
                        padding: "10px 14px",
                        borderRadius: mine
                          ? "18px 4px 18px 18px"
                          : "4px 18px 18px 18px",
                        fontSize: 14,
                        boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                        whiteSpace: "pre-wrap",
                        position: "relative",
                      }}
                    >
                      {m.text}
                      {mine && (
                        <span style={{ fontSize: 10, marginLeft: 6 }}>
                          {m.localStatus === "error"
                            ? "✕"
                            : m.localStatus === "sending"
                            ? "✔"
                            : "✔✔"}
                        </span>
                      )}
                    </div>
                    <small
                      style={{
                        fontSize: 10,
                        color: "#999",
                        marginTop: 4,
                        alignSelf: mine ? "flex-end" : "flex-start",
                      }}
                    >
                      {m.ts || ""}
                    </small>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={inputRow}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              placeholder={!connected ? "Connecting..." : "Write a message"}
              disabled={!connected}
              style={{
                flex: 1,
                padding: "12px 16px",
                border: "1px solid #cdd8cd",
                borderRadius: 26,
                fontSize: 15,
              }}
            />
            <button
              onClick={send}
              disabled={!connected || !input.trim() || !farmerId}
              style={{
                background: "linear-gradient(90deg,#2e7d32,#4caf50)",
                color: "#fff",
                border: "none",
                borderRadius: 28,
                padding: "12px 22px",
                fontSize: 15,
                fontWeight: 600,
                cursor: !connected || !input.trim() ? "not-allowed" : "pointer",
                opacity: !connected ? 0.6 : 1,
              }}
            >
              Send
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
