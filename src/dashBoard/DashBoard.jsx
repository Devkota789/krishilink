// export default DashBoard;
import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DashboardNavbar from "../components/DashboardNavbar";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import GoLiveChatModal from "../components/GoLiveChatModal";
import RecentOrdersPanel from "../components/buyerDashboard/RecentOrdersPanel";
import OrderInProgressTracker from "../components/buyerDashboard/OrderInProgressTracker";
import CartSnapshot from "../components/buyerDashboard/CartSnapshot";
import { useAuth } from "../context/AuthContext";
import { productAPI, notificationAPI } from "../api/api";
import "./DashBoard.css";

function CropDetectionTool() {
  const getToken = () => {
    try {
      return (
        (typeof sessionStorage !== "undefined" &&
          sessionStorage.getItem("authToken")) ||
        localStorage.getItem("authToken")
      );
    } catch {
      return localStorage.getItem("authToken");
    }
  };
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith("image/")) {
      setSelectedFile(file);
      setPreview(URL.createObjectURL(file));
      setResult("");
    }
  };

  const handleDetect = async () => {
    if (!selectedFile) return;
    const token = getToken();
    if (!token) {
      setResult("You are not logged in. Please log in to use this feature.");
      return;
    }
    setLoading(true);
    const formData = new FormData();
    formData.append("cropImage", selectedFile);
    try {
      const response = await fetch(
        "https://w1vqqn7ucvzpndp9xsvdkd15gzcedswvilahs3agd6b3dljo7tg24pbklk4u.shamir.com.np/api/AI/detectDisease",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );
      if (response.status === 401) {
        setResult("Authentication failed. Please log in again.");
        setLoading(false);
        return;
      }
      if (!response.ok) {
        let serverMsg = "";
        try {
          const ct = response.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            const j = await response.json();
            serverMsg = j.message || j.error || "";
          } else {
            serverMsg = await response.text();
          }
        } catch {}
        setResult(
          "The uploaded image is invalid or an internal error occurred. Please try with a clear crop image."
        );
        console.warn(
          "Disease detection error status",
          response.status,
          serverMsg
        );
        setLoading(false);
        return;
      }
      const text = await response.text();
      if (!text || text.trim() === "") {
        setResult(
          "No diagnosis returned. The uploaded image may be invalid. Try another clearer image."
        );
      } else {
        setResult(text);
      }
    } catch (err) {
      setResult(
        "The uploaded image is not a leaf image or an internal error occurred. Please try again with a different image."
      );
    }
    setLoading(false);
  };

  return (
    <div
      style={{
        border: "1px solid #e0e0e0",
        borderRadius: 12,
        padding: 24,
        margin: "24px 0",
        background: "#fafafa",
        maxWidth: 500,
      }}
    >
      <h2>🌱 Crop Disease Detection AI</h2>
      <p>Upload a photo of your crop to detect diseases and get solutions.</p>
      <button
        onClick={() => fileInputRef.current.click()}
        style={{ marginBottom: 12 }}
      >
        📷 Choose Image
      </button>
      <input
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        ref={fileInputRef}
        onChange={handleFileChange}
      />
      {preview && (
        <div style={{ margin: "12px 0" }}>
          <img
            src={preview}
            alt="Crop Preview"
            style={{ maxWidth: 200, borderRadius: 8 }}
          />
        </div>
      )}
      {selectedFile && (
        <button
          onClick={handleDetect}
          disabled={loading}
          style={{ marginBottom: 12 }}
        >
          {loading ? "Detecting..." : "Detect Disease"}
        </button>
      )}
      {result && (
        <div
          style={{
            background: "#e8f5e9",
            border: "1px solid #a5d6a7",
            borderRadius: 8,
            padding: 16,
            marginTop: 16,
            whiteSpace: "pre-line",
          }}
        >
          <strong>Result:</strong>
          <div>{result}</div>
        </div>
      )}
    </div>
  );
}

// Lightweight metric card component
const MetricCard = ({ label, value }) => (
  <div
    style={{
      background: "#fff",
      border: "1px solid #e3efe3",
      borderRadius: 14,
      padding: "0.9rem 1rem 0.95rem",
      boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
      display: "flex",
      flexDirection: "column",
      gap: 4,
      minHeight: 86,
    }}
  >
    <span
      style={{
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: 0.8,
        color: "#6a876a",
        fontWeight: 600,
      }}
    >
      {label}
    </span>
    <span style={{ fontSize: 22, fontWeight: 700, color: "#2e7d32" }}>
      {value}
    </span>
  </div>
);

const DashBoard = ({ embedded = false }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  // Products & market data
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(null);

  // Fetch products for metrics & popularity (lightweight aggregation)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setProductsLoading(true);
        const resp = await productAPI.getAllProducts();
        if (!mounted) return;
        if (resp?.data && Array.isArray(resp.data)) {
          setProducts(resp.data);
        } else if (resp?.data?.data && Array.isArray(resp.data.data)) {
          setProducts(resp.data.data);
        } else {
          setProducts([]);
        }
        setProductsError(null);
      } catch (e) {
        if (mounted) setProductsError(e.message || "Failed to load products");
      } finally {
        if (mounted) setProductsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Derive metrics
  const marketMetrics = useMemo(() => {
    if (!products || products.length === 0)
      return {
        totalProducts: 0,
        avgPrice: 0,
        maxPrice: 0,
        minPrice: 0,
        myProducts: 0,
      };
    const rates = products.map((p) => Number(p.rate) || 0).filter((n) => n > 0);
    const sum = rates.reduce((a, b) => a + b, 0);
    const avg = rates.length ? sum / rates.length : 0;
    const max = rates.length ? Math.max(...rates) : 0;
    const min = rates.length ? Math.min(...rates) : 0;
    const myProducts = products.filter((p) => {
      const farmerName = p.farmerName || p.farmer || "";
      const myName = user?.fullName || user?.name || "";
      return (
        myName &&
        farmerName &&
        farmerName.toLowerCase() === myName.toLowerCase()
      );
    }).length;
    return {
      totalProducts: products.length,
      avgPrice: avg,
      maxPrice: max,
      minPrice: min,
      myProducts,
    };
  }, [products, user]);

  const popularProducts = useMemo(() => {
    if (!products || products.length === 0) return [];
    // Heuristic: products with lower availableQuantity first (assume selling fast), fallback to rate
    const copy = [...products];
    copy.sort((a, b) => {
      const aqA = a.availableQuantity ?? Infinity;
      const aqB = b.availableQuantity ?? Infinity;
      if (aqA !== aqB) return aqA - aqB; // lower quantity = more sold
      return (b.rate || 0) - (a.rate || 0);
    });
    return copy.slice(0, 5);
  }, [products]);

  // Build simple chart points for market price distribution (first 20 products)
  const chartPoints = useMemo(() => {
    const subset = products.slice(0, 20);
    if (subset.length === 0) return [];
    const max = Math.max(...subset.map((p) => Number(p.rate) || 0), 1);
    return subset.map((p, idx) => ({
      x: idx,
      y: ((Number(p.rate) || 0) / max) * 100,
      value: Number(p.rate) || 0,
      label: p.productName?.slice(0, 10) || `P${idx + 1}`,
    }));
  }, [products]);
  // AI Chat state
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]); // { sender: 'user'|'ai', message: string }
  const [chatOpen, setChatOpen] = useState(false);
  const chatEndRef = useRef(null);
  // Persisted AI chat threads (history fetched from API)
  const [aiThreads, setAiThreads] = useState([]); // { id, title }
  const [aiThreadsLoading, setAiThreadsLoading] = useState(false);
  const [aiThreadsError, setAiThreadsError] = useState("");
  const [activeChatId, setActiveChatId] = useState(null);
  const [activeChatLoading, setActiveChatLoading] = useState(false);
  const [threadMenuOpenId, setThreadMenuOpenId] = useState(null); // for contextual menu
  const [threadDeletingId, setThreadDeletingId] = useState(null);

  const handleDeleteThread = async (chatId) => {
    if (!chatId) return;
    setThreadDeletingId(chatId);
    const token =
      (typeof sessionStorage !== "undefined" &&
        sessionStorage.getItem("authToken")) ||
      localStorage.getItem("authToken");
    try {
      const res = await fetch(
        `https://w1vqqn7ucvzpndp9xsvdkd15gzcedswvilahs3agd6b3dljo7tg24pbklk4u.shamir.com.np/api/AI/deleteAIChat/${chatId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}`, Accept: "*/*" },
        }
      );
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      setAiThreads((prev) => prev.filter((t) => t.id !== chatId));
      if (activeChatId === chatId) {
        setActiveChatId(null);
        try {
          localStorage.removeItem("aiActiveChatId");
        } catch {}
        setChatHistory([]);
      }
    } catch (e) {
      // Could add toast; for now append system error message
      setChatHistory((prev) => [
        ...prev,
        { sender: "ai", message: "Delete error: " + (e.message || "Unknown") },
      ]);
    } finally {
      setThreadDeletingId(null);
      setThreadMenuOpenId(null);
    }
  };
  const loadExistingChatMessages = async (chatId) => {
    if (!chatId) return;
    setActiveChatLoading(true);
    const token =
      (typeof sessionStorage !== "undefined" &&
        sessionStorage.getItem("authToken")) ||
      localStorage.getItem("authToken");
    try {
      const url = `https://w1vqqn7ucvzpndp9xsvdkd15gzcedswvilahs3agd6b3dljo7tg24pbklk4u.shamir.com.np/api/AI/getAIChatMessages/${chatId}`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "*/*",
        },
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      let data;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      const arr = data && Array.isArray(data.data) ? data.data : [];
      // Map each entry: prompt (user) then response (ai)
      const msgs = [];
      arr.forEach((m) => {
        if (m.prompt)
          msgs.push({
            sender: "user",
            message: m.prompt,
            _id: m.aiChatMessageId + "-p",
          });
        if (m.response)
          msgs.push({
            sender: "ai",
            message: m.response,
            _id: m.aiChatMessageId + "-r",
          });
      });
      setChatHistory(msgs);
    } catch (e) {
      setChatHistory([
        {
          sender: "ai",
          message:
            "Could not load previous messages: " +
            (e.message || "Unknown error"),
        },
      ]);
    } finally {
      setActiveChatLoading(false);
    }
  };
  // Persist activeChatId so a newly opened chat reuses the same thread
  useEffect(() => {
    try {
      if (activeChatId) localStorage.setItem("aiActiveChatId", activeChatId);
      else localStorage.removeItem("aiActiveChatId");
    } catch {}
  }, [activeChatId]);

  // Restore previously active chat when opening the chat modal
  useEffect(() => {
    try {
      if (chatOpen && !activeChatId) {
        const stored = localStorage.getItem("aiActiveChatId");
        if (stored) {
          setActiveChatId(stored);
          loadExistingChatMessages(stored);
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatOpen]);
  // Go Live modal state (reusing existing modal component)
  const GO_LIVE_KEY = "goLiveOpen_v1";
  const [showGoLive, setShowGoLive] = useState(() => {
    try {
      return localStorage.getItem(GO_LIVE_KEY) === "1";
    } catch {
      return false;
    }
  });
  React.useEffect(() => {
    try {
      if (showGoLive) localStorage.setItem(GO_LIVE_KEY, "1");
      else localStorage.removeItem(GO_LIVE_KEY);
    } catch {}
  }, [showGoLive]);
  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [notifActionLoading, setNotifActionLoading] = useState(false);
  const [notifCount, setNotifCount] = useState(0); // periodic count

  const fetchNotifications = async (openPanel = true) => {
    if (!user?.id && !user?.userId) return;
    const uid = user.id || user.userId || localStorage.getItem("userId");
    if (!uid) return;
    if (openPanel) setShowNotifications(true);
    setSelectedNotification(null);
    setNotifLoading(true);
    setNotifError("");
    try {
      const resp = await notificationAPI.getNotifications(uid);
      if (resp.success) {
        const data = resp.data || [];
        const arr = Array.isArray(data) ? data : [];
        const normalized = arr.map((n) => ({
          ...n,
          __isRead:
            n.isRead === true ||
            n.read === true ||
            (typeof n.status === "string" && n.status.toLowerCase() === "read"),
        }));
        normalized.sort((a, b) =>
          a.__isRead === b.__isRead ? 0 : a.__isRead ? 1 : -1
        );
        setNotifications(normalized);
        setNotifCount(normalized.length);
      } else {
        setNotifError(resp.error || "Failed to load");
      }
    } catch (e) {
      setNotifError(e.message || "Error");
    }
    setNotifLoading(false);
  };

  const handleMarkAsRead = async (n) => {
    if (!n) return;
    setNotifActionLoading(true);
    try {
      await notificationAPI.markAsRead(n.id || n.notificationId);
      await fetchNotifications(false);
      const stillExists = (notifications || []).find(
        (x) => (x.id || x.notificationId) === (n.id || n.notificationId)
      );
      if (!stillExists) setSelectedNotification(null);
    } catch (err) {
      /* swallow */
    }
    setNotifActionLoading(false);
  };

  const handleDeleteNotification = async (n) => {
    if (!n) return;
    setNotifActionLoading(true);
    try {
      await notificationAPI.deleteNotification(n.id || n.notificationId);
      await fetchNotifications(false);
      setSelectedNotification(null);
    } catch (err) {
      /* swallow */
    }
    setNotifActionLoading(false);
  };

  const handleClearAll = async () => {
    if (!notifications.length) return;
    setNotifActionLoading(true);
    try {
      await notificationAPI.clearAll();
      setNotifications([]);
      setNotifCount(0);
      setSelectedNotification(null);
    } catch (err) {
      /* swallow */
    }
    setNotifActionLoading(false);
  };

  // Lightweight polling for notification count every 10 minutes
  useEffect(() => {
    const uid = user?.id || user?.userId || localStorage.getItem("userId");
    if (!uid) return;
    let active = true;
    const loadCount = async () => {
      try {
        const resp = await notificationAPI.getNotifications(uid);
        if (!active) return;
        if (resp.success) {
          const data = resp.data || [];
          const arr = Array.isArray(data) ? data : [];
          setNotifCount(arr.length);
          // If panel is open keep full list in sync without forcing UI flicker
          if (showNotifications) {
            const normalized = arr.map((n) => ({
              ...n,
              __isRead:
                n.isRead === true ||
                n.read === true ||
                (typeof n.status === "string" &&
                  n.status.toLowerCase() === "read"),
            }));
            normalized.sort((a, b) =>
              a.__isRead === b.__isRead ? 0 : a.__isRead ? 1 : -1
            );
            setNotifications(normalized);
          }
        }
      } catch (e) {
        // silent – count stays last known
      }
    };
    loadCount();
    const interval = setInterval(loadCount, 600000); // 10 minutes
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [user, showNotifications]);

  // Close notifications on ESC
  useEffect(() => {
    if (!showNotifications) return;
    const handler = (e) => {
      if (e.key === "Escape") setShowNotifications(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showNotifications]);

  const handleAddProduct = () => {
    navigate("/add-product");
  };

  const handleViewProducts = () => {
    navigate("/products");
  };

  // Scroll to bottom on new message
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, chatOpen]);

  // AI Chat handler
  const handleSendToAI = async () => {
    if (!aiInput.trim()) return;
    const userMessage = aiInput;
    setChatHistory((prev) => [
      ...prev,
      { sender: "user", message: userMessage },
    ]);
    setAiInput("");
    setAiLoading(true);
    try {
      const token =
        (typeof sessionStorage !== "undefined" &&
          sessionStorage.getItem("authToken")) ||
        localStorage.getItem("authToken");
      const baseUrl =
        "https://w1vqqn7ucvzpndp9xsvdkd15gzcedswvilahs3agd6b3dljo7tg24pbklk4u.shamir.com.np/api/AI/chatWithAI";
      // Track current thread ids to infer a newly created one if server doesn't return chatId inline
      const prevIds = new Set((aiThreads || []).map((t) => String(t.id)));
      let nextActiveId = activeChatId;
      const url = activeChatId
        ? `${baseUrl}?chatID=${encodeURIComponent(activeChatId)}`
        : baseUrl;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "*/*",
        },
        body: JSON.stringify(userMessage),
      });
      // Try to read chat id from response headers if present
      try {
        const hdrId =
          res.headers.get("x-chat-id") ||
          res.headers.get("X-Chat-Id") ||
          res.headers.get("chatid") ||
          res.headers.get("chat-id") ||
          res.headers.get("ChatID");
        if (!nextActiveId && hdrId) {
          nextActiveId = String(hdrId);
          setActiveChatId(nextActiveId);
        }
      } catch {}
      const raw = await res.text();
      let aiText = raw;
      // Try to parse JSON if server returns structured data with chat id
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          if (parsed.response || parsed.answer)
            aiText = parsed.response || parsed.answer;
          if (!nextActiveId && (parsed.chatId || parsed.chatID || parsed.id)) {
            nextActiveId = String(parsed.chatId || parsed.chatID || parsed.id);
            setActiveChatId(nextActiveId);
          }
        }
      } catch {
        /* plain text */
      }
      setChatHistory((prev) => [...prev, { sender: "ai", message: aiText }]);
      const threads = await fetchAIThreads(false);
      // If still no chat id, infer from newly created thread
      if (!nextActiveId && threads && Array.isArray(threads)) {
        const newOnes = threads.filter((t) => !prevIds.has(String(t.id)));
        if (newOnes.length === 1) {
          nextActiveId = String(newOnes[0].id);
          setActiveChatId(nextActiveId);
        } else if (newOnes.length > 1) {
          const sorted = [...newOnes].sort((a, b) => {
            const ta = new Date(a.createdAt || 0).getTime();
            const tb = new Date(b.createdAt || 0).getTime();
            return tb - ta;
          });
          if (sorted[0]?.id) {
            nextActiveId = String(sorted[0].id);
            setActiveChatId(nextActiveId);
          }
        }
      }
    } catch (err) {
      setChatHistory((prev) => [
        ...prev,
        { sender: "ai", message: "Error: " + err.message },
      ]);
    }
    setAiLoading(false);
  };

  // Fetch AI chat history threads (titles)
  const fetchAIThreads = async (showLoading = true) => {
    const token =
      (typeof sessionStorage !== "undefined" &&
        sessionStorage.getItem("authToken")) ||
      localStorage.getItem("authToken");
    if (!token) return null; // user not authed
    if (showLoading) setAiThreadsLoading(true);
    setAiThreadsError("");
    try {
      // Use the history endpoint provided (different host than chat send API)
      const res = await fetch(
        "https://w1vqqn7ucvzpndp9xsvdkd15gzcedswvilahs3agd6b3dljo7tg24pbklk4u.shamir.com.np/api/AI/getAIChats",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json, */*",
          },
        }
      );
      if (!res.ok) {
        throw new Error(`Failed (${res.status})`);
      }
      // Attempt JSON parse; fallback to text
      let data;
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        data = await res.json();
      } else {
        const txt = await res.text();
        // naive attempt splitting lines as titles if not JSON
        data = txt
          ? txt
              .split(/\n+/)
              .filter(Boolean)
              .map((t, i) => ({ id: i, title: t }))
          : [];
      }
      // Normalise array of objects with id/title or name
      let threads = [];
      // API documented shape: { success, data: [] }
      if (data && typeof data === "object" && Array.isArray(data.data)) {
        threads = data.data.map((d, i) => {
          // Derive a reasonable title
          const title =
            d.title ||
            d.name ||
            d.subject ||
            d.summary ||
            (d.userMessage && typeof d.userMessage === "string"
              ? d.userMessage.slice(0, 60)
              : d.lastMessage || d.preview || `Chat ${i + 1}`);
          return {
            id: d.id || d.chatId || d._id || d.aiChatId || i,
            title,
            createdAt: d.createdAt || d.timestamp || null,
          };
        });
      } else if (Array.isArray(data)) {
        // fallback: server returned array directly
        threads = data.map((d, i) => ({
          id: d.id || d.chatId || d._id || i,
          title:
            d.title ||
            d.name ||
            d.subject ||
            d.summary ||
            (typeof d === "string"
              ? d.slice(0, 60)
              : d.lastMessage || "Chat " + (i + 1)),
          createdAt: d.createdAt || null,
        }));
      }
      setAiThreads(threads);
      return threads;
    } catch (e) {
      setAiThreadsError(e.message || "Failed to load chats");
      return null;
    } finally {
      setAiThreadsLoading(false);
    }
  };

  // Load threads when chat opens
  useEffect(() => {
    if (chatOpen) {
      fetchAIThreads();
    }
  }, [chatOpen]);

  if (loading) return <div className="dashboard-loading">Loading...</div>;
  if (!user)
    return <div className="dashboard-unauthorized">Not authorized</div>;

  const rootPageClass =
    user.role === "farmer" || user.role === "buyer" || user.role === "admin"
      ? "dashboard-page full-bleed"
      : "dashboard-page";
  // Add missing state for pinnedSidebar
  const [pinnedSidebar, setPinnedSidebar] = useState(true);

  return (
    <div className={rootPageClass}>
      {!embedded &&
        !showGoLive &&
        (user.role === "farmer" || user.role === "seller" ? (
          <DashboardNavbar />
        ) : (
          <Navbar />
        ))}
      <div className="dashboard-container">
        {user.role === "farmer" ||
        user.role === "buyer" ||
        user.role === "admin" ? (
          <div className="dashboard-flex">
            <aside
              className="dashboard-sidebar"
              aria-label="Farmer tools sidebar"
            >
              <div className="dashboard-sidebar-content">
                <section className="sidebar-section sidebar-notifications">
                  <div
                    className="sidebar-heading"
                    style={{
                      justifyContent: "space-between",
                      cursor: "pointer",
                    }}
                    onClick={() => fetchNotifications(true)}
                  >
                    <span>Notifications</span>
                    <span
                      style={{
                        background: "#2e7d32",
                        color: "#fff",
                        borderRadius: 12,
                        padding: "2px 6px",
                        fontSize: "0.65rem",
                        fontWeight: 600,
                      }}
                    >
                      {notifCount}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "#6a876a" }}>
                    Click to view all
                  </div>
                </section>
                {/* Universal quick links */}
                <section className="sidebar-section" style={{ paddingTop: 0 }}>
                  <button
                    type="button"
                    className="sidebar-btn"
                    onClick={() => navigate("/dashboard/my-reviews")}
                  >
                    {user?.role === "buyer" ? "My Reviews" : "Product Reviews"}
                  </button>
                </section>
                {user.role === "farmer" && (
                  <section
                    className="sidebar-section"
                    style={{ paddingTop: 0 }}
                  >
                    <button
                      type="button"
                      className="sidebar-btn"
                      onClick={() => setShowGoLive(true)}
                      title="Start a live session"
                    >
                      Go Live
                    </button>
                    {/* New: farmer quick links under Go Live */}
                    <button
                      type="button"
                      className="sidebar-btn"
                      onClick={() => navigate("/dashboard/add-product")}
                    >
                      Add Product
                    </button>
                    <button
                      type="button"
                      className="sidebar-btn"
                      onClick={() => navigate("/dashboard/my-products")}
                    >
                      My Products
                    </button>
                    <button
                      type="button"
                      className="sidebar-btn"
                      onClick={() => navigate("/dashboard/customer-orders")}
                      title="Orders placed by your customers"
                    >
                      Customer Orders
                    </button>
                  </section>
                )}
                {user.role === "admin" && (
                  <section
                    className="sidebar-section"
                    style={{ paddingTop: 0 }}
                  >
                    <button
                      type="button"
                      className="sidebar-btn"
                      onClick={() => navigate("/dashboard/users")}
                    >
                      Users
                    </button>
                    <button
                      type="button"
                      className="sidebar-btn"
                      onClick={() => navigate("/dashboard/admin/orders")}
                    >
                      Customer Orders
                    </button>
                    <button
                      type="button"
                      className="sidebar-btn"
                      onClick={() => navigate("/dashboard/admin/payments")}
                    >
                      Payments
                    </button>
                    <button
                      type="button"
                      className="sidebar-btn"
                      onClick={() => navigate("/dashboard/admin/market-price")}
                    >
                      Market Price
                    </button>
                  </section>
                )}
              </div>
            </aside>
            <div className="dashboard-main">
              {/* Top KPI & Graph Section */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "2rem",
                  marginBottom: "2.5rem",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
                    gap: "1rem",
                  }}
                >
                  <MetricCard
                    label="Total Products"
                    value={marketMetrics.totalProducts}
                  />
                  <MetricCard
                    label="Avg Price"
                    value={`₹${marketMetrics.avgPrice.toFixed(1)}`}
                  />
                  <MetricCard
                    label="Highest Price"
                    value={`₹${marketMetrics.maxPrice.toFixed(0)}`}
                  />
                  <MetricCard
                    label="Lowest Price"
                    value={`₹${marketMetrics.minPrice.toFixed(0)}`}
                  />
                  {user.role === "farmer" && (
                    <MetricCard
                      label="My Products"
                      value={marketMetrics.myProducts}
                    />
                  )}
                </div>
                <div
                  style={{
                    background: "#fff",
                    borderRadius: 16,
                    padding: "1.5rem 1.75rem 1.25rem",
                    boxShadow: "0 6px 24px rgba(0,0,0,0.06)",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "1.25rem",
                      color: "#2e7d32",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 20 }}>📈</span> Market Price
                    Distribution
                    {productsLoading && (
                      <span
                        style={{ fontSize: 12, marginLeft: 12, color: "#777" }}
                      >
                        Loading...
                      </span>
                    )}
                  </h2>
                  {productsError && (
                    <div
                      style={{ color: "#c62828", fontSize: 14, marginTop: 8 }}
                    >
                      {productsError}
                    </div>
                  )}
                  {!productsLoading &&
                    !productsError &&
                    chartPoints.length === 0 && (
                      <div
                        style={{ color: "#777", fontSize: 14, marginTop: 12 }}
                      >
                        No product data available.
                      </div>
                    )}
                  {chartPoints.length > 0 && (
                    <div
                      style={{
                        marginTop: 12,
                        height: 220,
                        position: "relative",
                      }}
                    >
                      <svg
                        width="100%"
                        height="100%"
                        viewBox={`0 0 ${chartPoints.length * 40} 200`}
                        preserveAspectRatio="xMidYMid meet"
                      >
                        {[0, 25, 50, 75, 100].map((g) => (
                          <line
                            key={g}
                            x1={0}
                            x2={chartPoints.length * 40}
                            y1={200 - (g / 100) * 160 - 20}
                            y2={200 - (g / 100) * 160 - 20}
                            stroke="#e0e0e0"
                            strokeWidth={1}
                          />
                        ))}
                        {chartPoints.map((pt, idx) => {
                          const barHeight = (pt.y / 100) * 160;
                          return (
                            <g key={idx}>
                              <rect
                                x={idx * 40 + 12}
                                y={180 - barHeight}
                                width={22}
                                height={barHeight}
                                rx={6}
                                fill="url(#grad)"
                              >
                                <title>
                                  {pt.label}: ₹{pt.value}
                                </title>
                              </rect>
                              <text
                                x={idx * 40 + 23}
                                y={195}
                                fontSize={9}
                                textAnchor="middle"
                                fill="#555"
                              >
                                {pt.label}
                              </text>
                            </g>
                          );
                        })}
                        <defs>
                          <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#4caf50" />
                            <stop offset="100%" stopColor="#81c784" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                  )}
                </div>
                {user.role === "buyer" && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
                      gap: "1.25rem",
                      marginTop: "1.5rem",
                    }}
                  >
                    <RecentOrdersPanel />
                    <OrderInProgressTracker />
                    <CartSnapshot />
                  </div>
                )}
              </div>
              {/* Existing content continues below for farmer */}
              <div
                className="dashboard-grid"
                style={{ marginBottom: "2.5rem" }}
              >
                <div
                  className="dashboard-card"
                  style={{ gridColumn: "1 / -1" }}
                >
                  <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 20 }}>🔥</span> Most Bought
                    (Heuristic)
                  </h2>
                  {productsLoading && (
                    <div style={{ color: "#777" }}>Loading product data...</div>
                  )}
                  {productsError && (
                    <div style={{ color: "#c62828" }}>{productsError}</div>
                  )}
                  {!productsLoading &&
                    !productsError &&
                    popularProducts.length === 0 && (
                      <div style={{ color: "#777" }}>
                        No product data to analyse.
                      </div>
                    )}
                  {popularProducts.length > 0 && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit,minmax(180px,1fr))",
                        gap: 16,
                      }}
                    >
                      {popularProducts.map((p) => (
                        <div
                          key={p.productId || p.id}
                          style={{
                            background: "#f9fbf9",
                            border: "1px solid #e2eee2",
                            borderRadius: 12,
                            padding: "0.9rem 0.95rem 0.85rem",
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            position: "relative",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              color: "#2e7d32",
                              fontSize: 14,
                            }}
                          >
                            {p.productName?.slice(0, 32) || "Unnamed"}
                          </div>
                          <div style={{ fontSize: 12, color: "#666" }}>
                            ₹{p.rate} / {p.unit || "kg"}
                          </div>
                          <div style={{ fontSize: 11, color: "#888" }}>
                            Remaining: {p.availableQuantity ?? "-"}{" "}
                            {p.unit || "kg"}
                          </div>
                          <button
                            onClick={() =>
                              navigate(`/products/${p.productId || p.id}`)
                            }
                            style={{
                              marginTop: 4,
                              background:
                                "linear-gradient(90deg,#4caf50,#81c784)",
                              color: "#fff",
                              border: "none",
                              borderRadius: 6,
                              padding: "0.35rem 0.65rem",
                              fontSize: 12,
                              cursor: "pointer",
                              fontWeight: 600,
                              letterSpacing: 0.3,
                            }}
                          >
                            View
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop: 14, fontSize: 11, color: "#777" }}>
                    * Approximation: ordered by lowest remaining quantity &
                    price; replace with real sales API when available.
                  </div>
                </div>
              </div>
              {user?.role !== "buyer" && (
                <div style={{ marginTop: "1rem" }}>
                  <CropDetectionTool />
                </div>
              )}
            </div>
          </div>
        ) : (
          // Non-farmer original layout preserved
          <>
            {/* Top KPI & Graph Section */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "2rem",
                marginBottom: "2.5rem",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
                  gap: "1rem",
                }}
              >
                <MetricCard
                  label="Total Products"
                  value={marketMetrics.totalProducts}
                />
                <MetricCard
                  label="Avg Price"
                  value={`₹${marketMetrics.avgPrice.toFixed(1)}`}
                />
                <MetricCard
                  label="Highest Price"
                  value={`₹${marketMetrics.maxPrice.toFixed(0)}`}
                />
                <MetricCard
                  label="Lowest Price"
                  value={`₹${marketMetrics.minPrice.toFixed(0)}`}
                />
              </div>
              <div
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  padding: "1.5rem 1.75rem 1.25rem",
                  boxShadow: "0 6px 24px rgba(0,0,0,0.06)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: "1.25rem",
                    color: "#2e7d32",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 20 }}>📈</span> Market Price
                  Distribution
                  {productsLoading && (
                    <span
                      style={{ fontSize: 12, marginLeft: 12, color: "#777" }}
                    >
                      Loading...
                    </span>
                  )}
                </h2>
                {productsError && (
                  <div style={{ color: "#c62828", fontSize: 14, marginTop: 8 }}>
                    {productsError}
                  </div>
                )}
                {!productsLoading &&
                  !productsError &&
                  chartPoints.length === 0 && (
                    <div style={{ color: "#777", fontSize: 14, marginTop: 12 }}>
                      No product data available.
                    </div>
                  )}
                {chartPoints.length > 0 && (
                  <div
                    style={{ marginTop: 12, height: 220, position: "relative" }}
                  >
                    <svg
                      width="100%"
                      height="100%"
                      viewBox={`0 0 ${chartPoints.length * 40} 200`}
                      preserveAspectRatio="xMidYMid meet"
                    >
                      {[0, 25, 50, 75, 100].map((g) => (
                        <line
                          key={g}
                          x1={0}
                          x2={chartPoints.length * 40}
                          y1={200 - (g / 100) * 160 - 20}
                          y2={200 - (g / 100) * 160 - 20}
                          stroke="#e0e0e0"
                          strokeWidth={1}
                        />
                      ))}
                      {chartPoints.map((pt, idx) => {
                        const barHeight = (pt.y / 100) * 160;
                        return (
                          <g key={idx}>
                            <rect
                              x={idx * 40 + 12}
                              y={180 - barHeight}
                              width={22}
                              height={barHeight}
                              rx={6}
                              fill="url(#grad)"
                            >
                              <title>
                                {pt.label}: ₹{pt.value}
                              </title>
                            </rect>
                            <text
                              x={idx * 40 + 23}
                              y={195}
                              fontSize={9}
                              textAnchor="middle"
                              fill="#555"
                            >
                              {pt.label}
                            </text>
                          </g>
                        );
                      })}
                      <defs>
                        <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4caf50" />
                          <stop offset="100%" stopColor="#81c784" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                )}
              </div>
            </div>
            <div
              className="dashboard-grid"
              style={{ marginBottom: "2.5rem" }}
            ></div>
            <div
              className="dashboard-card"
              style={{ gridColumn: "1 / -1" }}
            ></div>
            <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>🔥</span> Most Bought (Heuristic)
            </h2>
            {productsLoading && (
              <div style={{ color: "#777" }}>Loading product data...</div>
            )}
            {productsError && (
              <div style={{ color: "#c62828" }}>{productsError}</div>
            )}
            {!productsLoading &&
              !productsError &&
              popularProducts.length === 0 && (
                <div style={{ color: "#777" }}>No product data to analyse.</div>
              )}
            {popularProducts.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
                  gap: 16,
                }}
              >
                {popularProducts.map((p) => (
                  <div
                    key={p.productId || p.id}
                    style={{
                      background: "#f9fbf9",
                      border: "1px solid #e2eee2",
                      borderRadius: 12,
                      padding: "0.9rem 0.95rem 0.85rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        color: "#2e7d32",
                        fontSize: 14,
                      }}
                    >
                      {p.productName?.slice(0, 32) || "Unnamed"}
                    </div>
                    <div style={{ fontSize: 12, color: "#666" }}>
                      ₹{p.rate} / {p.unit || "kg"}
                    </div>
                    <div style={{ fontSize: 11, color: "#888" }}>
                      Remaining: {p.availableQuantity ?? "-"} {p.unit || "kg"}
                    </div>
                    <button
                      onClick={() =>
                        navigate(`/products/${p.productId || p.id}`)
                      }
                      style={{
                        marginTop: 4,
                        background: "linear-gradient(90deg,#4caf50,#81c784)",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        padding: "0.35rem 0.65rem",
                        fontSize: 12,
                        cursor: "pointer",
                        fontWeight: 600,
                        letterSpacing: 0.3,
                      }}
                    >
                      View
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 14, fontSize: 11, color: "#777" }}>
              * Approximation: ordered by lowest remaining quantity & price;
              replace with real sales API when available.
            </div>
            {/* </div> */}

            {/* // </div> */}
            {user?.role !== "buyer" && (
              <div style={{ marginTop: "1rem" }}>
                <CropDetectionTool />
              </div>
            )}
          </>
        )}

        {/* Big Animated Robot Icon for AI Chat - Fixed Bottom Right */}
        {(user.role === "farmer" || user.role === "admin") && !chatOpen && (
          <div
            className="big-robot-icon-animate ai-robot-fixed"
            onClick={() => setChatOpen(true)}
            style={{
              position: "fixed",
              bottom: 112,
              right: 40,
              width: 110,
              height: 110,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #e8f5e9 60%, #81c784 100%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 32px #388e3c22",
              zIndex: 1100,
              cursor: "pointer",
              transition: "box-shadow 0.2s",
              userSelect: "none",
            }}
            title="Chat with Krishi AI"
          >
            {/* Large Chat Bubble Icon */}
            <span
              style={{
                width: 64,
                height: 64,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <circle
                  cx="32"
                  cy="32"
                  r="30"
                  fill="#e8f5e9"
                  stroke="#81c784"
                  strokeWidth="2"
                />
                <path
                  d="M16 44V24a8 8 0 0 1 8-8h16a8 8 0 0 1 8 8v12a8 8 0 0 1-8 8H24l-8 8z"
                  fill="#fff"
                  stroke="#388e3c"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <circle cx="28" cy="34" r="2.5" fill="#81c784" />
                <circle cx="36" cy="34" r="2.5" fill="#81c784" />
              </svg>
            </span>
            {/* Animated chat dots */}
            <span
              className="chat-dots-animate"
              style={{
                display: "flex",
                gap: 4,
                marginTop: 4,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#4caf50",
                  opacity: 0.7,
                  animation: "dot-bounce 1.2s infinite 0s",
                }}
              ></span>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#4caf50",
                  opacity: 0.7,
                  animation: "dot-bounce 1.2s infinite 0.2s",
                }}
              ></span>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#4caf50",
                  opacity: 0.7,
                  animation: "dot-bounce 1.2s infinite 0.4s",
                }}
              ></span>
            </span>
            <div
              style={{
                fontWeight: 700,
                color: "#388e3c",
                fontSize: 16,
                letterSpacing: 1,
                textShadow: "0 2px 8px #e8f5e9",
                marginTop: 2,
              }}
            >
              Krishi AI
            </div>
          </div>
        )}
        {/* Full Screen AI Chat Modal (unchanged) */}
        {(user.role === "farmer" || user.role === "admin") && chatOpen && (
          <div
            className="ai-chat-modal"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(0,0,0,0.18)",
              zIndex: 2000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "100vw",
                height: "100vh",
                background: "#fff",
                borderRadius: 0,
                boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
                display: "flex",
                flexDirection: "row",
                position: "relative",
              }}
            >
              {/* Main Chat Area with Pinnable Sidebar */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: "100%",
                  height: "100%",
                }}
              >
                {/* Top Bar */}
                <div
                  style={{
                    background:
                      "linear-gradient(90deg, #4caf50 0%, #81c784 100%)",
                    padding: "1.5rem 2rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 16 }}
                  >
                    <span
                      style={{
                        background: "#fff",
                        borderRadius: "50%",
                        width: 54,
                        height: 54,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 36,
                        marginRight: 12,
                        boxShadow: "0 2px 8px #388e3c22",
                      }}
                    >
                      🤖
                    </span>
                    <div>
                      <h2
                        style={{
                          color: "#388e3c",
                          margin: 0,
                          fontWeight: 700,
                          fontSize: 28,
                        }}
                      >
                        Krishi AI Chat
                      </h2>
                      <p style={{ color: "#e8f5e9", margin: 0, fontSize: 15 }}>
                        Ask anything about farming, crops, or your products!
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setChatOpen(false)}
                    style={{
                      background: "#fff",
                      border: "none",
                      borderRadius: "50%",
                      width: 44,
                      height: 44,
                      fontSize: 26,
                      color: "#388e3c",
                      boxShadow: "0 2px 8px #388e3c22",
                      cursor: "pointer",
                    }}
                    title="Close"
                  >
                    X
                  </button>
                </div>
                {/* Chat Area with Sidebar */}
                <div
                  style={{
                    display: "flex",
                    flex: 1,
                    height: "calc(100% - 110px)",
                  }}
                >
                  {/* Left Sidebar for Chat History (pinnable) */}
                  {typeof window !== "undefined" && (
                    <div
                      style={{
                        width: pinnedSidebar ? 200 : 44,
                        minWidth: pinnedSidebar ? 220 : 44,
                        maxWidth: pinnedSidebar ? "30vw" : 44,
                        background: "#f1faf1",
                        borderRight: "1px solid #e0e0e0",
                        display: "flex",
                        flexDirection: "column",
                        transition: "width 0.2s",
                        position: "relative",
                      }}
                    >
                      <button
                        onClick={() => setPinnedSidebar((prev) => !prev)}
                        style={{
                          position: "absolute",
                          top: 10,
                          right: pinnedSidebar ? 10 : "auto",
                          left: pinnedSidebar ? "auto" : 6,
                          background: "#fff",
                          border: "1px solid #c8e6c9",
                          borderRadius: "50%",
                          width: 28,
                          height: 28,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 16,
                          color: "#388e3c",
                          boxShadow: "0 2px 6px #388e3c11",
                          cursor: "pointer",
                          zIndex: 2,
                        }}
                        title={pinnedSidebar ? "Minimize" : "Pin sidebar"}
                      >
                        {pinnedSidebar ? "⏴" : "⏵"}
                      </button>
                      {pinnedSidebar && (
                        <>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: 20,
                              color: "#388e3c",
                              marginBottom: 18,
                              textAlign: "center",
                              marginTop: 38,
                            }}
                          >
                            Chat History
                          </div>
                          {/* Persisted threads list */}
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 10,
                              marginBottom: 18,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "flex-end",
                                marginBottom: 4,
                              }}
                            >
                              <button
                                onClick={() => {
                                  setActiveChatId(null);
                                  setChatHistory([]);
                                  try {
                                    localStorage.removeItem("aiActiveChatId");
                                  } catch {}
                                }}
                                style={{
                                  background: "#4caf50",
                                  color: "#fff",
                                  border: "none",
                                  borderRadius: 6,
                                  padding: "6px 16px",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                                }}
                                title="Start new chat"
                              >
                                + New
                              </button>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 6,
                                marginBottom: 4,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  letterSpacing: 0.5,
                                  color: "#2e7d32",
                                  textTransform: "uppercase",
                                }}
                              >
                                Previous Chats
                              </span>
                              <button
                                onClick={() => fetchAIThreads()}
                                disabled={aiThreadsLoading}
                                style={{
                                  background: "#fff",
                                  border: "1px solid #c8e6c9",
                                  borderRadius: 6,
                                  padding: "2px 8px",
                                  fontSize: 11,
                                  cursor: aiThreadsLoading
                                    ? "not-allowed"
                                    : "pointer",
                                }}
                                title="Refresh chats"
                              >
                                {aiThreadsLoading ? "..." : "↺"}
                              </button>
                            </div>
                            <div
                              style={{
                                flexGrow: 1,
                                minHeight: 240,
                                overflowY: "auto",
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                                border: "1px solid #e0e0e0",
                                borderRadius: 10,
                                padding: 8,
                                background: "#fff",
                              }}
                            >
                              {aiThreadsError && (
                                <div style={{ fontSize: 12, color: "#c62828" }}>
                                  {aiThreadsError}
                                </div>
                              )}
                              {!aiThreadsError &&
                                aiThreadsLoading &&
                                aiThreads.length === 0 && (
                                  <div style={{ fontSize: 12, color: "#777" }}>
                                    Loading chats...
                                  </div>
                                )}
                              {!aiThreadsError &&
                                !aiThreadsLoading &&
                                aiThreads.length === 0 && (
                                  <div style={{ fontSize: 12, color: "#777" }}>
                                    No previous chats.
                                  </div>
                                )}
                              {aiThreads.map((t) => (
                                <div
                                  key={t.id}
                                  style={{ position: "relative" }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 4,
                                    }}
                                  >
                                    <button
                                      onClick={() => {
                                        if (t.id !== activeChatId) {
                                          setActiveChatId(t.id);
                                          loadExistingChatMessages(t.id);
                                        }
                                      }}
                                      style={{
                                        flex: 1,
                                        background:
                                          t.id === activeChatId
                                            ? "linear-gradient(90deg,#4caf50,#81c784)"
                                            : "#e8f5e9",
                                        border: "1px solid #c8e6c9",
                                        padding: "6px 8px",
                                        borderRadius: 8,
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color:
                                          t.id === activeChatId
                                            ? "#fff"
                                            : "#2e7d32",
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 6,
                                      }}
                                      title={t.title}
                                    >
                                      {activeChatLoading &&
                                      t.id === activeChatId
                                        ? "Loading…"
                                        : t.title}
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setThreadMenuOpenId((p) =>
                                          p === t.id ? null : t.id
                                        );
                                      }}
                                      style={{
                                        background: "#fff",
                                        border: "1px solid #c8e6c9",
                                        borderRadius: 8,
                                        width: 32,
                                        height: 32,
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 18,
                                        color: "#2e7d32",
                                      }}
                                      title="More options"
                                    >
                                      ⋯
                                    </button>
                                  </div>
                                  {threadMenuOpenId === t.id && (
                                    <div
                                      style={{
                                        position: "absolute",
                                        top: 38,
                                        right: 0,
                                        background: "#fff",
                                        border: "1px solid #e0e0e0",
                                        borderRadius: 8,
                                        boxShadow:
                                          "0 4px 12px rgba(0,0,0,0.12)",
                                        padding: 4,
                                        zIndex: 10,
                                        minWidth: 120,
                                      }}
                                    >
                                      <button
                                        onClick={() => handleDeleteThread(t.id)}
                                        disabled={threadDeletingId === t.id}
                                        style={{
                                          width: "100%",
                                          background: "#ffebee",
                                          border: "1px solid #ffcdd2",
                                          color: "#c62828",
                                          borderRadius: 6,
                                          padding: "6px 8px",
                                          fontSize: 12,
                                          fontWeight: 600,
                                          cursor:
                                            threadDeletingId === t.id
                                              ? "not-allowed"
                                              : "pointer",
                                        }}
                                      >
                                        {threadDeletingId === t.id
                                          ? "Deleting…"
                                          : "Delete"}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                          {/* Removed per requirement: no message previews in sidebar */}
                        </>
                      )}
                    </div>
                  )}
                  {/* Main Chat Area */}
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        overflowY: "auto",
                        padding: "2rem 0",
                        background: "#f7fafc",
                      }}
                    >
                      <div style={{ maxWidth: 700, margin: "0 auto" }}>
                        {chatHistory.length === 0 && (
                          <div
                            style={{
                              color: "#888",
                              textAlign: "center",
                              marginTop: 32,
                              fontSize: 18,
                            }}
                          >
                            Start a conversation with Krishi AI!
                          </div>
                        )}
                        {chatHistory.map((msg, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: "flex",
                              justifyContent:
                                msg.sender === "user"
                                  ? "flex-end"
                                  : "flex-start",
                              marginBottom: 18,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "flex-end",
                                gap: 12,
                              }}
                            >
                              {msg.sender === "ai" && (
                                <span
                                  style={{
                                    background: "#e8f5e9",
                                    borderRadius: "50%",
                                    width: 44,
                                    height: 44,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 28,
                                    marginRight: 4,
                                    boxShadow: "0 2px 8px #388e3c11",
                                  }}
                                >
                                  🤖
                                </span>
                              )}
                              <div
                                style={{
                                  maxWidth: 420,
                                  padding: "0.9rem 1.3rem",
                                  borderRadius: 18,
                                  background:
                                    msg.sender === "user"
                                      ? "linear-gradient(90deg, #4caf50 0%, #81c784 100%)"
                                      : "#fff",
                                  color:
                                    msg.sender === "user" ? "#fff" : "#333",
                                  boxShadow:
                                    msg.sender === "user"
                                      ? "0 2px 8px rgba(76,175,80,0.10)"
                                      : "0 2px 8px rgba(0,0,0,0.04)",
                                  borderTopRightRadius:
                                    msg.sender === "user" ? 4 : 18,
                                  borderTopLeftRadius:
                                    msg.sender === "user" ? 18 : 4,
                                  fontSize: 17,
                                  position: "relative",
                                }}
                              >
                                {msg.message}
                              </div>
                              {msg.sender === "user" && (
                                <span
                                  style={{
                                    background: "#e8f5e9",
                                    borderRadius: "50%",
                                    width: 44,
                                    height: 44,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 28,
                                    marginLeft: 4,
                                    boxShadow: "0 2px 8px #388e3c11",
                                  }}
                                >
                                  🧑‍🌾
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                        <div ref={chatEndRef} />
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "2rem",
                        background: "#f7fafc",
                        borderBottomLeftRadius: 0,
                        borderBottomRightRadius: 0,
                        maxWidth: 700,
                        margin: "0 auto",
                        width: "100%",
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Type your question..."
                        style={{
                          flex: 1,
                          padding: "1.1rem 1.3rem",
                          borderRadius: 24,
                          border: "1px solid #c8e6c9",
                          fontSize: 17,
                          outline: "none",
                          background: "#fff",
                          marginRight: 12,
                          boxShadow: "0 1px 2px rgba(76,175,80,0.04)",
                        }}
                        value={aiInput}
                        onChange={(e) => setAiInput(e.target.value)}
                        disabled={aiLoading}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSendToAI();
                        }}
                        autoFocus
                      />
                      <button
                        className="action-button"
                        onClick={handleSendToAI}
                        disabled={aiLoading || !aiInput.trim()}
                        style={{
                          borderRadius: "50%",
                          width: 54,
                          height: 54,
                          background:
                            "linear-gradient(90deg, #4caf50 0%, #81c784 100%)",
                          color: "#fff",
                          border: "none",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 28,
                          boxShadow: "0 2px 8px rgba(76,175,80,0.10)",
                          transition: "background 0.2s",
                          cursor:
                            aiLoading || !aiInput.trim()
                              ? "not-allowed"
                              : "pointer",
                          opacity: aiLoading || !aiInput.trim() ? 0.7 : 1,
                        }}
                        title="Send"
                      >
                        {aiLoading ? (
                          <span
                            className="loader"
                            style={{
                              width: 28,
                              height: 28,
                              border: "3px solid #fff",
                              borderTop: "3px solid #81c784",
                              borderRadius: "50%",
                              display: "inline-block",
                              animation: "spin 1s linear infinite",
                            }}
                          />
                        ) : (
                          <svg
                            width="28"
                            height="28"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M3 20L21 12L3 4V10L17 12L3 14V20Z"
                              fill="currentColor"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        <GoLiveChatModal
          open={showGoLive}
          onClose={() => setShowGoLive(false)}
        />
        {/* Notifications Slide-in Panel */}
        {showNotifications && (
          <div
            className="notif-overlay"
            onClick={() => setShowNotifications(false)}
          >
            <aside className="notif-panel" onClick={(e) => e.stopPropagation()}>
              <header className="notif-panel-header">
                {!selectedNotification && (
                  <>
                    <h3>
                      Notifications{" "}
                      {notifications.length > 0 && (
                        <span
                          style={{
                            fontSize: "0.65rem",
                            background: "#fff",
                            color: "#2e7d32",
                            padding: "2px 6px",
                            borderRadius: 12,
                            marginLeft: 6,
                            fontWeight: 600,
                          }}
                        >
                          {notifications.length}
                        </span>
                      )}
                    </h3>
                    <div
                      style={{ display: "flex", gap: 8, alignItems: "center" }}
                    >
                      <button
                        className="notif-clear-all"
                        disabled={
                          notifActionLoading ||
                          notifLoading ||
                          notifications.length === 0
                        }
                        onClick={handleClearAll}
                        title="Clear All"
                      >
                        {notifActionLoading ? "…" : "Clear All"}
                      </button>
                      <button
                        className="notif-refresh"
                        onClick={() => fetchNotifications(false)}
                        title="Refresh"
                        disabled={notifLoading || notifActionLoading}
                      >
                        ↺
                      </button>
                      <button
                        className="notif-close"
                        onClick={() => setShowNotifications(false)}
                        title="Close"
                      >
                        ×
                      </button>
                    </div>
                  </>
                )}
                {selectedNotification && (
                  <>
                    <h3
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        cursor: "pointer",
                      }}
                      onClick={() => setSelectedNotification(null)}
                      title="Back"
                    >
                      ← Notifications
                    </h3>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="notif-close"
                        onClick={() => setShowNotifications(false)}
                        title="Close"
                      >
                        ×
                      </button>
                    </div>
                  </>
                )}
              </header>
              <div className="notif-panel-body">
                {selectedNotification ? (
                  <div className="notif-detail">
                    {(() => {
                      const msg =
                        selectedNotification.message ||
                        selectedNotification.body ||
                        selectedNotification.description ||
                        selectedNotification.text ||
                        selectedNotification.title ||
                        "Notification";
                      return (
                        <div
                          className="notif-detail-body"
                          style={{ whiteSpace: "pre-wrap" }}
                        >
                          {msg}
                        </div>
                      );
                    })()}
                    {(() => {
                      const sender =
                        selectedNotification.sender ||
                        selectedNotification.from ||
                        null;
                      return (
                        <div className="notif-meta-row">
                          <strong style={{ marginRight: 4 }}>Sender:</strong>
                          <span>{sender || "—"}</span>
                        </div>
                      );
                    })()}
                    {(() => {
                      const actionUrl =
                        selectedNotification.actionUrl ||
                        selectedNotification.actionURL ||
                        selectedNotification.url ||
                        "";
                      const isLink = /^https?:\/\//i.test(actionUrl);
                      return (
                        <div className="notif-meta-row">
                          <strong style={{ marginRight: 4 }}>
                            Action URL:
                          </strong>
                          {actionUrl ? (
                            isLink ? (
                              <a
                                href={actionUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  color: "#1565c0",
                                  fontWeight: 600,
                                  wordBreak: "break-all",
                                }}
                              >
                                {actionUrl}
                              </a>
                            ) : (
                              <span>{actionUrl}</span>
                            )
                          ) : (
                            <span>—</span>
                          )}
                        </div>
                      );
                    })()}
                    <div className="notif-detail-actions">
                      {!selectedNotification.__isRead && (
                        <button
                          onClick={() => handleMarkAsRead(selectedNotification)}
                          disabled={notifActionLoading}
                          className="notif-action-btn mark"
                        >
                          {notifActionLoading ? "..." : "Mark as Read"}
                        </button>
                      )}
                      <button
                        onClick={() =>
                          handleDeleteNotification(selectedNotification)
                        }
                        disabled={notifActionLoading}
                        className="notif-action-btn delete"
                      >
                        {notifActionLoading ? "..." : "Clear"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {notifLoading && (
                      <div className="notif-status">Loading...</div>
                    )}
                    {notifError && (
                      <div className="notif-status error">{notifError}</div>
                    )}
                    {!notifLoading &&
                      !notifError &&
                      notifications.length === 0 && (
                        <div className="notif-status empty">
                          No notifications
                        </div>
                      )}
                    <ul className="notif-list">
                      {notifications.map((n, idx) => {
                        const id = n.id || n.notificationId || idx;
                        return (
                          <li
                            key={id}
                            className={`notif-item notif-clickable ${
                              n.__isRead ? "read" : "unread"
                            } ${
                              selectedNotification &&
                              (selectedNotification.id ||
                                selectedNotification.notificationId) ===
                                (n.id || n.notificationId)
                                ? "selected"
                                : ""
                            }`}
                            onClick={() => setSelectedNotification(n)}
                            title="View details"
                          >
                            <div className="notif-type-line">
                              {!n.__isRead && <span className="notif-dot" />}
                              {(() => {
                                const typeVal =
                                  n.type ||
                                  n.notificationType ||
                                  n.category ||
                                  n.status ||
                                  "Notice";
                                const isAlert = /alert/i.test(typeVal);
                                return (
                                  <span
                                    className={`notif-type-badge ${
                                      isAlert ? "alert" : ""
                                    }`}
                                  >
                                    {typeVal}
                                  </span>
                                );
                              })()}
                            </div>
                            <div className="notif-message-line">
                              {(
                                n.title ||
                                n.message ||
                                n.text ||
                                "Notification"
                              ).slice(0, 80)}
                              {(n.title || n.message || n.text || "").length >
                              80
                                ? "…"
                                : ""}
                            </div>
                            {n.createdAt && (
                              <div className="notif-time">
                                {new Date(n.createdAt).toLocaleString()}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>
            </aside>
          </div>
        )}
        {/* Loader animation keyframes and chat dots animation */}
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes dot-bounce {
            0%, 80%, 100% { transform: translateY(0); opacity: 0.7; }
            40% { transform: translateY(-12px); opacity: 1; }
          }
          .big-robot-icon-animate {
            animation: robot-bounce 1.8s infinite;
          }
          @keyframes robot-bounce {
            0%, 100% { transform: translateY(0) scale(1); box-shadow: 0 8px 32px #388e3c22, 0 0 0 0 #81c78444; }
            20% { transform: translateY(-10px) scale(1.05); box-shadow: 0 16px 32px #388e3c22, 0 0 0 12px #81c78422; }
            40% { transform: translateY(0) scale(1); }
          }
          .ai-robot-fixed:hover {
            box-shadow: 0 12px 40px #388e3c44, 0 0 0 8px #81c78433;
          }
          /* SVG robot animation */
          .robot-eye {
            animation: blink 3.2s infinite;
          }
          @keyframes blink {
            0%, 90%, 100% { ry: 4; }
            92%, 98% { ry: 1; }
          }
          .robot-antenna {
            animation: antenna-pulse 2.2s infinite;
          }
          @keyframes antenna-pulse {
            0%, 100% { r: 4; }
            50% { r: 6; }
          }
          .robot-hand {
            transform-origin: 10px 38px;
            animation: hand-wave 2.5s infinite;
          }
          @keyframes hand-wave {
            0%, 100% { transform: rotate(-10deg); }
            10% { transform: rotate(-30deg); }
            20% { transform: rotate(-10deg); }
          }
    .notif-overlay { position: fixed; inset:0; background: rgba(0,0,0,0.25); z-index:2100; display:flex; justify-content:flex-end; }
    .notif-panel { width:360px; max-width:90vw; height:100%; background:#ffffff; box-shadow:-4px 0 24px rgba(0,0,0,0.12); animation: slideIn .35s ease; display:flex; flex-direction:column; }
    @keyframes slideIn { from { transform: translateX(60px); opacity:0;} to { transform: translateX(0); opacity:1;} }
    .notif-panel-header { padding:1rem 1.2rem; display:flex; align-items:center; justify-content:space-between; background:linear-gradient(90deg,#4caf50,#81c784); color:#fff; }
    .notif-panel-header h3 { margin:0; font-size:1rem; letter-spacing:0.5px; }
    .notif-panel-body { flex:1; overflow-y:auto; padding:1rem 1rem 1.4rem; display:flex; flex-direction:column; gap:0.75rem; }
    .notif-refresh, .notif-close { background:#fff; border:none; width:32px; height:32px; border-radius:50%; cursor:pointer; font-size:16px; font-weight:600; color:#2e7d32; box-shadow:0 2px 6px rgba(0,0,0,0.12); display:flex; align-items:center; justify-content:center; }
    .notif-refresh:hover, .notif-close:hover { background:#e8f5e9; }
    .notif-status { font-size:0.8rem; color:#546e55; padding:0.5rem; background:#f3f8f4; border:1px solid #e2efe4; border-radius:8px; text-align:center; }
    .notif-status.error { background:#fdecea; border-color:#f5c4bf; color:#c62828; }
    .notif-status.empty { font-style:italic; }
    .notif-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:0.6rem; }
    .notif-item { border:1px solid #e2efe4; border-radius:10px; padding:0.7rem 0.85rem 0.75rem; background:#fcfdfc; display:flex; flex-direction:column; gap:0.35rem; box-shadow:0 2px 6px rgba(56,142,60,0.05); }
    .notif-item.unread { background:#f1faf1; border-color:#b7dfba; box-shadow:0 2px 10px rgba(76,175,80,0.12); }
    .notif-item.read { opacity:0.8; }
    .notif-item.selected { outline:2px solid #ff9800; box-shadow:0 0 0 3px #ff980033; }
    .notif-item:hover { background:#f2faf2; }
    .notif-title { font-size:0.85rem; font-weight:600; color:#2e7d32; line-height:1.25; }
    .notif-dot { display:inline-block; width:8px; height:8px; border-radius:50%; background:#ff9800; margin-right:6px; box-shadow:0 0 0 4px #ff980015, 0 0 4px #ff9800aa; }
    .notif-time { font-size:0.65rem; color:#6b876b; letter-spacing:0.3px; }
    .notif-clear-all { background:#fff; border:none; height:32px; padding:0 12px; border-radius:18px; font-size:12px; font-weight:600; cursor:pointer; color:#2e7d32; box-shadow:0 2px 6px rgba(0,0,0,0.12); letter-spacing:.4px; }
    .notif-clear-all:disabled { opacity:.55; cursor:not-allowed; }
    .notif-item.notif-clickable { cursor:pointer; }
    .notif-item.notif-clickable:hover { border-color:#cfe9d1; }
    .notif-detail { display:flex; flex-direction:column; gap:.9rem; animation: fadeIn .25s ease; }
    @keyframes fadeIn { from {opacity:0; transform:translateY(4px);} to {opacity:1; transform:translateY(0);} }
    .notif-detail-title { margin:0; font-size:1rem; font-weight:600; color:#2e7d32; line-height:1.25; }
    /* Updated sizes & colors for type/title */
    .notif-detail-type { font-size:1rem; font-weight:700; color:#2e7d32; letter-spacing:.5px; }
    .notif-detail-type.alert { color:#c62828; }
    .notif-detail-title { font-size:.8rem; font-weight:600; color:#2e7d32; }
    .notif-detail-time { font-size:.65rem; color:#6b876b; background:#f3f9f3; padding:4px 8px; border-radius:12px; width:max-content; letter-spacing:.3px; font-weight:500; }
    .notif-detail-body { margin:0; font-size:.8rem; line-height:1.4; color:#455a46; background:#fcfdfc; border:1px solid #e2efe4; padding:.75rem .85rem; border-radius:10px; box-shadow:0 2px 4px rgba(0,0,0,.04); white-space:pre-wrap; }
    .notif-detail-actions { display:flex; gap:.75rem; margin-top:.25rem; flex-wrap:wrap; }
    .notif-action-btn { border:none; padding:.55rem .95rem; font-size:.7rem; font-weight:600; text-transform:uppercase; letter-spacing:.8px; border-radius:8px; cursor:pointer; display:inline-flex; align-items:center; gap:.4rem; transition:background .18s, box-shadow .18s; }
    .notif-action-btn.mark { background:linear-gradient(90deg,#4caf50,#81c784); color:#fff; box-shadow:0 2px 8px rgba(76,175,80,.25); }
    .notif-action-btn.mark:hover { box-shadow:0 4px 14px rgba(76,175,80,.35); }
    .notif-action-btn.delete { background:#ffecec; color:#c62828; border:1px solid #ffcdd2; }
    .notif-action-btn.delete:hover { background:#ffcdd2; }
    .notif-action-btn:disabled { opacity:.55; cursor:not-allowed; box-shadow:none; }
    .notif-meta-row { font-size:.65rem; color:#2e5030; background:#f3f9f3; padding:4px 8px; border-radius:8px; display:flex; align-items:center; gap:4px; margin-top:4px; }
    /* Type badge styling */
    .notif-type-line { display:flex; align-items:center; gap:.4rem; }
    .notif-type-badge { font-size:.8rem; font-weight:600; background:#e8f5e9; color:#2e7d32; padding:2px 8px; border-radius:12px; letter-spacing:.4px; line-height:1; }
    .notif-type-badge.alert { background:#ffebee; color:#c62828; font-weight:700; }
    .notif-message-line { font-size:.7rem; color:#2e5030; line-height:1.3; }
    @media (max-width:600px){ .notif-panel { width:100%; } }
        `}</style>
      </div>
      {/* Footer for buyer & farmer/seller dashboards */}
      {(user?.role === "buyer" ||
        user?.role === "farmer" ||
        user?.role === "seller" ||
        user?.role === "admin") && <Footer />}
    </div>
  );
};

export default DashBoard;
