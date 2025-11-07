import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { productAPI, orderAPI, checkAuthStatus } from "../api/api";
import { useAuth } from "../context/AuthContext";
import DashboardNavbar from "../components/DashboardNavbar";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import {
  FaUser,
  FaPhone,
  FaMapMarkerAlt,
  FaShoppingCart,
  FaSeedling,
} from "react-icons/fa";
import AnimatedEye from "../components/AnimatedEye";
import { motion } from "framer-motion";
import BulkOrderModal from "../components/BulkOrderModal"; // (still unused but preserved)
import GoLiveChatModal from "../components/GoLiveChatModal";
import "./Marketplace.css";
import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";

const Marketplace = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [orderQuantity, setOrderQuantity] = useState({});
  const [orderMessage, setOrderMessage] = useState({ text: "", type: "" });
  const { user } = useAuth();
  const navigate = useNavigate();
  const BASE_URL =
    "https://w1vqqn7ucvzpndp9xsvdkd15gzcedswvilahs3agd6b3dljo7tg24pbklk4u.shamir.com.np";

  // Live status per product (boolean | 'loading') keyed by product id
  const [productLiveStatus, setProductLiveStatus] = useState({});
  const [showGoLive, setShowGoLive] = useState(false);
  const [viewerCounts, setViewerCounts] = useState({});
  const viewerHubRef = useRef(null);
  const [viewerHubConnected, setViewerHubConnected] = useState(false);
  const initialViewerCountsRequestedRef = useRef(false);

  useEffect(() => {
    fetchProducts();
    checkAuthStatus();
  }, []);

  // Listen for viewer count broadcasts only (no join per product here)
  useEffect(() => {
    let mounted = true;
    const conn = new HubConnectionBuilder()
      .withUrl(`${BASE_URL}/productViewHub`)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Error)
      .build();
    viewerHubRef.current = conn;
    conn.on("ProductViewerCountUpdated", (pid, count) => {
      if (!mounted) return;
      setViewerCounts((prev) => ({ ...prev, [pid]: count || 0 }));
    });
    const start = async () => {
      try {
        await conn.start();
        if (mounted) setViewerHubConnected(true);
      } catch (e) {
        if (mounted) setTimeout(start, 4000);
      }
    };
    start();
    return () => {
      mounted = false;
      (async () => {
        try {
          await viewerHubRef.current?.stop();
        } catch (_) {}
      })();
    };
  }, []);

  // Attempt to pull current viewer counts explicitly after products + hub connected (covers hard refresh scenario)
  useEffect(() => {
    const fetchInitialFromHub = async () => {
      if (initialViewerCountsRequestedRef.current) return; // only once per page load
      if (!viewerHubConnected) return;
      if (!products || products.length === 0) return;
      const conn = viewerHubRef.current;
      if (!conn) return;
      initialViewerCountsRequestedRef.current = true;
      console.debug(
        "[ViewerInit] Attempting hub-side initial viewer counts..."
      );
      const productIds = products.map((p) => p.id).filter(Boolean);
      // Helper to normalize various possible return shapes
      const applyCounts = (payload) => {
        if (!payload) return;
        const next = {};
        if (Array.isArray(payload)) {
          payload.forEach((row) => {
            if (!row) return;
            const pid = row.productId || row.id || row.pid;
            if (pid !== undefined)
              next[pid] = row.count ?? row.viewers ?? row.value ?? 0;
          });
        } else if (typeof payload === "object") {
          // Could be a map { productId: count }
          Object.entries(payload).forEach(([k, v]) => {
            const num = typeof v === "number" ? v : v?.count || v?.viewers || 0;
            next[k] = num || 0;
          });
        }
        if (Object.keys(next).length) {
          setViewerCounts((prev) => ({ ...next, ...prev }));
        }
      };
      // Candidate bulk method names
      const bulkMethods = [
        "GetAllViewerCounts",
        "GetViewerCounts",
        "FetchAllViewerCounts",
        "FetchViewerCounts",
      ];
      let success = false;
      for (const m of bulkMethods) {
        try {
          console.debug(`[ViewerInit] Trying bulk hub method: ${m}`);
          const res = await conn.invoke(m, productIds); // some hubs may ignore parameter
          applyCounts(res);
          success = true;
          console.debug(`[ViewerInit] Bulk method ${m} succeeded.`);
          break;
        } catch (err) {
          console.debug(
            `[ViewerInit] Bulk method ${m} failed:`,
            err?.message || err
          );
        }
      }
      if (success) return;
      // Fallback: per-product method names
      const singleMethods = ["GetViewerCount", "GetProductViewerCount"];
      for (const pid of productIds) {
        let got = false;
        for (const m of singleMethods) {
          try {
            console.debug(
              `[ViewerInit] Trying single hub method: ${m} for product ${pid}`
            );
            const val = await conn.invoke(m, pid);
            const num =
              typeof val === "number" ? val : val?.count || val?.viewers || 0;
            setViewerCounts((prev) => ({ ...prev, [pid]: num || 0 }));
            got = true;
            break;
          } catch (_) {}
        }
        if (!got) {
          console.debug(
            `[ViewerInit] No single-method viewer count for product ${pid}; awaiting broadcast.`
          );
        }
      }
      console.debug(
        "[ViewerInit] Initial viewer count attempts complete. Current map:",
        viewerCounts
      );
    };
    fetchInitialFromHub();
  }, [products, viewerHubConnected]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await productAPI.getAllProducts();
      console.log("Products response:", response); // Debug log
      if (response.data) {
        // Map API fields to UI fields for consistency
        const mappedProducts = response.data.map((product) => ({
          ...product,
          id: product.productId,
          name: product.productName,
          price: product.rate,
          sellerName: product.farmerName,
          sellerPhoneNumber: product.farmerEmailorPhone,
          imageUrl: product.imageCode
            ? `${BASE_URL}/api/Product/getProductImage/${product.imageCode}`
            : null,
        }));
        setProducts(mappedProducts);
        // Queue live status loading for these products
        queueLiveStatusFetch(mappedProducts);
        // Initial viewer counts fetch (just once per page load / refresh)
        try {
          const ids = mappedProducts.map((p) => p.id).filter(Boolean);
          const vcResp = await productAPI.getViewerCounts(ids);
          if (vcResp?.data && Array.isArray(vcResp.data)) {
            // Expect array of { productId, count }
            const countsObj = {};
            vcResp.data.forEach((row) => {
              if (row && (row.productId || row.id)) {
                const pid = row.productId || row.id;
                countsObj[pid] = row.count ?? 0;
              }
            });
            setViewerCounts((prev) => ({ ...countsObj, ...prev })); // hub updates will merge later
            console.debug(
              "[ViewerInit] REST viewer counts prefetch success:",
              countsObj
            );
          }
        } catch (e) {
          console.warn(
            "Viewer counts prefetch failed (fallback to hub updates only)",
            e?.message || e
          );
        }
      } else {
        setError("No products found");
      }
    } catch (err) {
      console.error("Error fetching products:", err);
      setError("Failed to load products. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = (productId, value) => {
    setOrderQuantity((prev) => ({
      ...prev,
      [productId]: value,
    }));
  };

  const handlePlaceOrder = async (product) => {
    if (!user) {
      setOrderMessage({
        text: "Please login to place an order",
        type: "error",
      });
      return;
    }
    if (user.role !== "buyer") {
      setOrderMessage({ text: "Only buyers can place orders", type: "error" });
      return;
    }

    // Check if user has valid authentication
    const token =
      (typeof sessionStorage !== "undefined" &&
        sessionStorage.getItem("authToken")) ||
      localStorage.getItem("authToken");
    if (!token) {
      setOrderMessage({
        text: "Authentication token missing. Please login again.",
        type: "error",
      });
      return;
    }

    console.log("User authenticated:", !!user);
    console.log("Token exists:", !!token);
    console.log("User role:", user.role);

    const quantity = orderQuantity[product.id];
    if (!quantity || quantity <= 0) {
      setOrderMessage({ text: "Please enter a valid quantity", type: "error" });
      return;
    }
    try {
      // Create FormData for multipart/form-data with exact API field names
      const formData = new FormData();
      formData.append("productId", product.id);
      formData.append("productQuantity", quantity);
      formData.append("totalPrice", product.price * quantity);
      formData.append("orderStatus", "pending");
      formData.append("paymentStatus", "pending");
      formData.append("refundStatus", "none");

      console.log(
        "Sending order request with token:",
        token.substring(0, 20) + "..."
      );
      const response = await orderAPI.addOrder(formData);
      if (response.data) {
        setOrderMessage({
          text: "Order placed successfully!",
          type: "success",
        });
        setOrderQuantity((prev) => ({ ...prev, [product.id]: "" }));
        fetchProducts();
        setTimeout(() => {
          navigate("/my-orders");
        }, 1500);
      }
    } catch (err) {
      console.error("Order placement error:", err);
      console.error("Error response:", err.response);
      setOrderMessage({
        text:
          err.response?.data?.message ||
          "Failed to place order. Please try again.",
        type: "error",
      });
    }
  };

  // Remove cart-related state and handlers

  const handleImageError = (e) => {
    e.target.src =
      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==";
  };

  // --- Live status helpers (simplified from Products page) ---
  const fetchLiveStatus = async (id) => {
    try {
      const resp = await fetch(
        `${BASE_URL}/api/Chat/IsFarmerLive/${encodeURIComponent(id)}`,
        { headers: { Accept: "application/json" } }
      );
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json();
      const live =
        data?.data === true || data?.live === true || data?.isLive === true;
      setProductLiveStatus((prev) => ({ ...prev, [id]: live }));
    } catch (e) {
      setProductLiveStatus((prev) => ({ ...prev, [id]: false }));
    }
  };

  const queueLiveStatusFetch = (items) => {
    if (!Array.isArray(items)) return;
    const ids = items
      .map((p) => p.id)
      .filter(Boolean)
      .filter((id) => productLiveStatus[id] === undefined);
    if (ids.length === 0) return;
    setProductLiveStatus((prev) => ({
      ...prev,
      ...Object.fromEntries(ids.map((id) => [id, "loading"])),
    }));
    ids.forEach((id) => fetchLiveStatus(id));
  };

  // Periodically refresh all statuses every 60s
  useEffect(() => {
    if (!products.length) return;
    const interval = setInterval(() => {
      products.forEach((p) => fetchLiveStatus(p.id));
    }, 60000);
    return () => clearInterval(interval);
  }, [products]);

  const handleLiveChat = (product) => {
    // Redirect if not authenticated
    if (!user) return navigate("/login");
    // Only buyers can initiate chat here
    if (user.role !== "buyer") return;
    const status = productLiveStatus[product.id];
    if (status === false) {
      window.alert(
        "Farmer is offline. You can chat when the farmer is online."
      );
      return;
    }
    // If still loading / unknown treat like offline message (optional)
    if (status === undefined || status === "loading") {
      window.alert("Checking farmer status. Please try again in a moment.");
      return;
    }
    // Online -> open chat modal
    setShowGoLive(true);
  };

  if (loading) {
    return (
      <div className="marketplace-container">
        <DashboardNavbar />
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading products...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="marketplace-container">
        <DashboardNavbar />
        <div className="error-container">
          <p>{error}</p>
          <button onClick={fetchProducts} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="marketplace-container">
      {user?.role === "farmer" ||
      user?.role === "seller" ||
      user?.role === "admin" ? (
        <DashboardNavbar />
      ) : (
        <Navbar />
      )}
      <div className="marketplace-content">
        <div className="marketplace-header">
          <h1>Marketplace</h1>
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {/* Remove cart icon/button */}
          </div>
        </div>

        {orderMessage.text && (
          <div className={`order-message ${orderMessage.type}`}>
            {orderMessage.text}
          </div>
        )}

        <div className="products-grid">
          {products.length === 0 ? (
            <div className="no-products">
              <p>No products available at the moment.</p>
            </div>
          ) : (
            products.map((product) => (
              <motion.div
                key={product.id}
                className="product-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                whileHover={{ scale: 1.02 }}
              >
                <div className="product-image">
                  <img
                    src={
                      product.imageUrl ||
                      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=="
                    }
                    alt={product.name}
                    onError={handleImageError}
                  />
                  <div
                    className="viewer-count-chip"
                    data-closed={
                      (viewerCounts[product.id] ?? 0) === 0 ? "true" : "false"
                    }
                    title="Current viewers on this product"
                  >
                    <AnimatedEye count={viewerCounts[product.id] ?? 0} />
                    <span style={{ marginLeft: 4 }}>
                      {viewerCounts[product.id] ?? 0}
                    </span>
                  </div>
                </div>
                <div className="product-info">
                  <h3>{product.name}</h3>
                  <p className="price">₹{product.price} per kg</p>
                  <p className="description">{product.description}</p>
                  <div className="seller-info">
                    <p>
                      <FaUser /> {product.sellerName}
                    </p>
                    <p>
                      <FaPhone /> {product.sellerPhoneNumber}
                    </p>
                    <p>
                      <FaMapMarkerAlt /> {product.address}
                    </p>
                  </div>
                  {/* Chat with Farmer (only for buyers or guests). Reuse status dot styles from Products page via Marketplace.css additions */}
                  {(!user || user.role === "buyer") && (
                    <button
                      className="live-chat-btn"
                      onClick={() => handleLiveChat(product)}
                      style={{ marginTop: "8px", marginBottom: "8px" }}
                      title={
                        !user
                          ? "Login to chat with Farmer"
                          : productLiveStatus[product.id] === true
                          ? "Farmer online"
                          : productLiveStatus[product.id] === false
                          ? "Farmer offline"
                          : "Checking status..."
                      }
                      type="button"
                    >
                      <span
                        className={`farmer-status-dot ${
                          productLiveStatus[product.id] === "loading"
                            ? "loading"
                            : productLiveStatus[product.id] === true
                            ? "online"
                            : productLiveStatus[product.id] === false
                            ? "offline"
                            : "unknown"
                        }`}
                        aria-label={
                          productLiveStatus[product.id] === true
                            ? "Farmer online"
                            : productLiveStatus[product.id] === false
                            ? "Farmer offline"
                            : "Farmer status unknown"
                        }
                      />
                      Chat with Farmer
                    </button>
                  )}
                  {user && (
                    <div className="order-section">
                      <input
                        type="number"
                        min="1"
                        value={orderQuantity[product.id] || ""}
                        onChange={(e) =>
                          handleQuantityChange(product.id, e.target.value)
                        }
                        placeholder="Enter Quantity (kg)"
                        className="quantity-input"
                      />
                      <button
                        className="order-button"
                        onClick={() => handlePlaceOrder(product)}
                        disabled={!user}
                      >
                        <FaShoppingCart /> Place Order
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
      {/* Remove BulkOrderModal */}
      <Footer />
      <GoLiveChatModal open={showGoLive} onClose={() => setShowGoLive(false)} />
    </div>
  );
};

export default Marketplace;
