import React, { useState, useEffect, useRef } from "react";
import { productAPI, orderAPI } from "../api/api";
import Navbar from "../components/Navbar";
import DashboardNavbar from "../components/DashboardNavbar";
import Footer from "../components/Footer";
import "./Products.css";
import { useNavigate, Link } from "react-router-dom";
import { FaMapMarkerAlt, FaUser, FaShoppingCart } from "react-icons/fa";
import AnimatedEye from "../components/AnimatedEye";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import noImage from "../assets/Images/no-image.png";
import GoLiveChatModal from "../components/GoLiveChatModal";
import BuyerFarmerChatModal from "../components/BuyerFarmerChatModal";
import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";

const BASE_URL =
  "https://w1vqqn7ucvzpndp9xsvdkd15gzcedswvilahs3agd6b3dljo7tg24pbklk4u.shamir.com.np";

// Simple error boundary to catch render errors so the page doesn't go blank
// Role-aware navbar so farmer keeps dashboard navbar when viewing marketplace/products
const RoleAwareNavbar = () => {
  const { user } = useAuth();
  return user?.role === "farmer" ? <DashboardNavbar /> : <Navbar />;
};

class ProductsErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("Products page crashed:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="products-page" style={{ paddingTop: 80 }}>
          <RoleAwareNavbar />
          <main
            className="content-grow"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                maxWidth: 600,
                background: "#fff",
                padding: "2rem",
                borderRadius: 12,
                boxShadow: "0 4px 20px rgba(0,0,0,0.07)",
              }}
            >
              <h2 style={{ marginTop: 0 }}>Something went wrong</h2>
              <p style={{ color: "#c62828" }}>{this.state.error?.message}</p>
              <button
                onClick={() => window.location.reload()}
                style={{
                  background: "#2e7d32",
                  color: "#fff",
                  border: "none",
                  padding: "0.75rem 1.25rem",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                Reload Page
              </button>
            </div>
          </main>
          <Footer />
        </div>
      );
    }
    return this.props.children;
  }
}

const ProductsInner = () => {
  const [products, setProducts] = useState([]);
  const [nearbyProducts, setNearbyProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orderQuantity, setOrderQuantity] = useState({});
  const [orderMessage, setOrderMessage] = useState({ text: "", type: "" });
  const GO_LIVE_KEY = "goLiveOpen_v1";
  const [showGoLive, setShowGoLive] = useState(() => {
    try {
      return localStorage.getItem(GO_LIVE_KEY) === "1";
    } catch {
      return false;
    }
  });
  // Buyer-farmer chat modal state
  const [chatProductId, setChatProductId] = useState(null);
  const [showBuyerChat, setShowBuyerChat] = useState(false);
  React.useEffect(() => {
    try {
      if (showGoLive) localStorage.setItem(GO_LIVE_KEY, "1");
      else localStorage.removeItem(GO_LIVE_KEY);
    } catch {}
  }, [showGoLive]);
  const [userLocation, setUserLocation] = useState(null);
  const [nearbyProductsLoaded, setNearbyProductsLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [showNearbyOnly, setShowNearbyOnly] = useState(false);
  // Client-side incremental reveal: load 2 rows (8 items) first then +8 each scroll
  const INITIAL_VISIBLE = 8; // 2 rows * 4 columns
  const INCREMENT = 8; // reveal 2 more rows
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const sentinelRef = useRef(null);
  const ioRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  // Live status per product (via /api/Chat/IsFarmerLive/{productId})
  const [productLiveStatus, setProductLiveStatus] = useState({});
  // Viewer counts via SignalR hub broadcast
  const [viewerCounts, setViewerCounts] = useState({});
  const viewerHubRef = useRef(null);

  // IMPORTANT: Keep all hooks (including useMemo) before any conditional return to avoid
  // 'Rendered more hooks than during the previous render' errors.
  const combinedProducts = React.useMemo(() => {
    try {
      let combined;
      if (showNearbyOnly) {
        combined = [...nearbyProducts];
      } else {
        const nonNearby = products.filter(
          (p) => !nearbyProducts.find((n) => n.productId === p.productId)
        );
        combined = [...nearbyProducts, ...nonNearby];
      }

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        combined = combined.filter(
          (p) =>
            p.productName?.toLowerCase().includes(term) ||
            p.description?.toLowerCase().includes(term) ||
            p.city?.toLowerCase().includes(term) ||
            p.farmerName?.toLowerCase().includes(term)
        );
      }

      combined = [...combined];
      switch (sortBy) {
        case "priceLow":
          combined.sort((a, b) => (a.rate || 0) - (b.rate || 0));
          break;
        case "priceHigh":
          combined.sort((a, b) => (b.rate || 0) - (a.rate || 0));
          break;
        case "quantity":
          combined.sort(
            (a, b) => (b.availableQuantity || 0) - (a.availableQuantity || 0)
          );
          break;
        case "distance":
          combined.sort((a, b) => {
            const distA = parseFloat(a.distance) || Infinity;
            const distB = parseFloat(b.distance) || Infinity;
            return distA - distB;
          });
          break;
        default:
          break;
      }
      return combined;
    } catch (e) {
      console.error("Error computing combinedProducts", e);
      return [];
    }
  }, [products, nearbyProducts, searchTerm, sortBy, showNearbyOnly]);

  // Display only currently revealed products
  const displayedProducts = combinedProducts.slice(0, visibleCount);

  // Observe sentinel to increase visible count (client-side reveal)
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    if (visibleCount >= combinedProducts.length) return; // all revealed
    // Use bottom rootMargin to pre-load as the user approaches the bottom
    ioRef.current?.disconnect?.();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisibleCount((v) =>
              Math.min(v + INCREMENT, combinedProducts.length)
            );
          }
        }
      },
      { root: null, rootMargin: "0px 0px 400px 0px", threshold: 0 }
    );
    observer.observe(node);
    ioRef.current = observer;
    return () => observer.disconnect();
  }, [visibleCount, combinedProducts.length]);

  // Fallback: in case IntersectionObserver doesn't fire (rare layout/UA cases)
  useEffect(() => {
    const checkAndLoadMore = () => {
      if (visibleCount >= combinedProducts.length) return;
      const node = sentinelRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const viewH = window.innerHeight || document.documentElement.clientHeight;
      if (rect.top <= viewH + 120) {
        setVisibleCount((v) =>
          Math.min(v + INCREMENT, combinedProducts.length)
        );
      }
    };
    const opts = { passive: true };
    window.addEventListener("scroll", checkAndLoadMore, opts);
    window.addEventListener("resize", checkAndLoadMore, opts);
    // Run once on mount for short lists
    setTimeout(checkAndLoadMore, 0);
    return () => {
      window.removeEventListener("scroll", checkAndLoadMore);
      window.removeEventListener("resize", checkAndLoadMore);
    };
  }, [visibleCount, combinedProducts.length]);

  // Reset visible count when filters criteria change
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
  }, [searchTerm, sortBy, showNearbyOnly]);

  useEffect(() => {
    // Get user's location first, then fetch products
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        // Print latitude and longitude to console
        console.log("=== USER LOCATION RETRIEVED ===");
        console.log(`Latitude: ${latitude}`);
        console.log(`Longitude: ${longitude}`);
        console.log("===============================");

        setUserLocation({ latitude, longitude });

        // Fetch nearby products first, then all products
        fetchNearbyProducts(latitude, longitude);
        fetchProducts();
      },
      (error) => {
        console.error("Location error:", error);
        console.log(
          "Location access denied or failed, fetching all products only"
        );
        setLocationLoading(false);
        // If location fails, just fetch all products
        fetchProducts();
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }, []);

  // Setup SignalR connection for product viewer counts (listen only)
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

  // Fallback timeout for nearby products
  useEffect(() => {
    const fallbackTimeout = setTimeout(() => {
      if (!nearbyProductsLoaded && products.length === 0) {
        console.log(
          "15 seconds timeout reached - ensuring regular products are loaded"
        );
        fetchProducts();
        setLocationLoading(false);
      }
    }, 15000);

    // Cleanup timeout when nearby products are loaded or component unmounts
    return () => clearTimeout(fallbackTimeout);
  }, [nearbyProductsLoaded, products.length]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("Fetching all products (single request)...");
      const fullResp = await productAPI.getAllProducts();
      let productsArray = [];
      if (Array.isArray(fullResp.data)) productsArray = fullResp.data;
      else if (fullResp.data && Array.isArray(fullResp.data.data))
        productsArray = fullResp.data.data;
      console.log("Total products fetched:", productsArray.length);
      const productsWithImages = productsArray.map((product, idx) => {
        const normalizedId =
          product.productId || product.productID || product.id || `p_${idx}`;
        return {
          ...product,
          productId: normalizedId,
          imageUrl: product.imageCode
            ? `${BASE_URL}/api/Product/getProductImage/${product.imageCode}`
            : null,
        };
      });
      setProducts(productsWithImages);
      // Reset visible count after refetch
      setVisibleCount(INITIAL_VISIBLE);
      // After products load, initiate product live status checks
      queueLiveStatusFetch(productsWithImages);
    } catch (err) {
      console.error("Error fetching products:", err);
      setError(err.message || "Failed to load products.");
    } finally {
      setLoading(false);
    }
  };

  const fetchNearbyProducts = async (latitude, longitude) => {
    try {
      setLocationLoading(true);
      console.log("=== CALLING NEARBY PRODUCTS API ===");
      console.log(
        `API URL: /api/Product/getNearProducts/${latitude},${longitude}`
      );
      console.log(`Latitude being sent: ${latitude}`);
      console.log(`Longitude being sent: ${longitude}`);
      console.log("==================================");

      const response = await productAPI.getNearProducts(latitude, longitude);

      console.log("Nearby Products API response:", response);

      let nearbyProductsArray = [];
      if (response.success && Array.isArray(response.data)) {
        nearbyProductsArray = response.data;
        console.log("Nearby products found:", nearbyProductsArray.length);
      } else if (response.data && Array.isArray(response.data.data)) {
        nearbyProductsArray = response.data.data;
        console.log(
          "Nearby products found (nested):",
          nearbyProductsArray.length
        );
      } else {
        console.log("No nearby products found or unexpected format");
      }

      // Log each product's distance for debugging
      nearbyProductsArray.forEach((product, index) => {
        console.log(
          `Product ${index + 1} distance:`,
          product.distance,
          typeof product.distance
        );
      });

      // Map nearby products with normalized IDs
      const nearbyProductsWithImages = nearbyProductsArray.map(
        (product, idx) => {
          const normalizedId =
            product.productId || product.productID || product.id || `np_${idx}`;
          return {
            ...product,
            productId: normalizedId,
            imageUrl: product.imageCode
              ? `${BASE_URL}/api/Product/getProductImage/${product.imageCode}`
              : null,
          };
        }
      );
      setNearbyProducts(nearbyProductsWithImages);
      setNearbyProductsLoaded(true);
      queueLiveStatusFetch(nearbyProductsWithImages);
    } catch (err) {
      console.error("Error fetching nearby products:", err);
      console.error("Nearby products error details:", err.response?.data);
      // If nearby products fail, ensure regular products are loaded
      setNearbyProductsLoaded(true);
    } finally {
      setLocationLoading(false);
      console.log("fetchNearbyProducts completed");
    }
  };

  const handleImageError = (e) => {
    e.target.src = noImage;
  };

  const handleSeeDetails = (productId) => {
    navigate(`/products/${productId}`);
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

    const quantity = orderQuantity[product.productId];
    if (!quantity || quantity <= 0) {
      setOrderMessage({ text: "Please enter a valid quantity", type: "error" });
      return;
    }

    if (quantity > product.availableQuantity) {
      setOrderMessage({
        text: "Order quantity exceeds available quantity",
        type: "error",
      });
      return;
    }

    try {
      const orderData = {
        productId: product.productId,
        quantity: parseInt(quantity),
        buyerId: user.id,
        farmerId: product.farmerId,
        totalAmount: product.rate * quantity,
      };

      const response = await orderAPI.addOrder(orderData);

      setOrderMessage({ text: "Order placed successfully!", type: "success" });
      // Clear the quantity input for this product
      setOrderQuantity((prev) => ({
        ...prev,
        [product.productId]: "",
      }));
      // Refresh products to update available quantity (keeps reveal state reset)
      fetchProducts();
    } catch (err) {
      console.error("Error placing order:", err);
      setOrderMessage({
        text: err.response?.data?.message || "Failed to place order",
        type: "error",
      });
    }
  };

  // --- Product Live Status Logic ---
  const queueLiveStatusFetch = (newProducts) => {
    if (!Array.isArray(newProducts) || newProducts.length === 0) return;
    const ids = newProducts
      .map((p) => p.productId)
      .filter(Boolean)
      .filter((id) => productLiveStatus[id] === undefined);
    if (ids.length === 0) return;
    // Mark these product IDs as loading
    setProductLiveStatus((prev) => ({
      ...prev,
      ...Object.fromEntries(ids.map((id) => [id, "loading"])),
    }));
    fetchLiveStatuses(ids);
  };

  const fetchLiveStatuses = async (ids) => {
    await Promise.all(
      ids.map(async (id) => {
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
      })
    );
  };

  useEffect(() => {
    queueLiveStatusFetch(combinedProducts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combinedProducts.length]);

  // Periodic refresh (every 60s) of all current products' live statuses
  useEffect(() => {
    const refreshAll = () => {
      const ids = combinedProducts.map((p) => p.productId).filter(Boolean);
      if (ids.length === 0) return;
      // Set all to loading before refresh to show user it's updating (optional)
      setProductLiveStatus((prev) => ({
        ...prev,
        ...Object.fromEntries(ids.map((id) => [id, "loading"])),
      }));
      fetchLiveStatuses(ids);
    };
    // Initial refresh sync (in case statuses were loaded long ago)
    const intervalId = setInterval(refreshAll, 60000); // 60,000 ms = 1 minute
    return () => clearInterval(intervalId);
  }, [combinedProducts]);

  const renderProductCard = (product, isNearby = false) => (
    <motion.div
      key={product.productId}
      className={`product-card ${isNearby ? "nearby-product" : ""}`}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <div className="product-image">
        <img
          src={product.imageUrl || noImage}
          alt={product.productName}
          onError={handleImageError}
        />
        <div
          className="viewer-count-chip"
          data-closed={
            (viewerCounts[product.productId] ?? 0) === 0 ? "true" : "false"
          }
          title="Current viewers on this product"
        >
          <AnimatedEye count={viewerCounts[product.productId] ?? 0} />
          <span style={{ marginLeft: 4 }}>
            {viewerCounts[product.productId] ?? 0}
          </span>
        </div>
        {isNearby && product.distance && (
          <div className="distance-badge">
            📍{" "}
            {typeof product.distance === "string" &&
            product.distance.includes("Km")
              ? product.distance
              : `${product.distance} Km`}
          </div>
        )}
      </div>
      <div className="product-info">
        <h3>{product.productName}</h3>
        <div className="price-line">
          ₹{product.rate} / {product.unit || "kg"}
        </div>
        <div className="info-row">
          <span className="info-left">
            {(() => {
              const lat =
                product.latitude ??
                product.lat ??
                product.Latitude ??
                product.Lat ??
                null;
              const lon =
                product.longitude ??
                product.lng ??
                product.lon ??
                product.Longitude ??
                product.Lng ??
                product.Lon ??
                null;
              if (product.distance) {
                const distanceLabel =
                  typeof product.distance === "string" &&
                  product.distance.includes("Km")
                    ? product.distance
                    : `${product.distance} Km`;
                if (
                  lat != null &&
                  lon != null &&
                  !isNaN(parseFloat(lat)) &&
                  !isNaN(parseFloat(lon))
                ) {
                  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    lat
                  )},${encodeURIComponent(lon)}`;
                  return (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="distance-link"
                      title="Open location in Google Maps"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FaMapMarkerAlt style={{ fontSize: "0.8rem" }} />{" "}
                      {distanceLabel}
                    </a>
                  );
                }
                return distanceLabel;
              }
              return <>\u00A0</>; // preserve height
            })()}
          </span>
          <span className="info-right">
            {product.availableQuantity ?? 0} {product.unit || "kg"} avail
          </span>
        </div>
        <div className="secondary-actions">
          <button
            className="view-details-btn"
            onClick={() => handleSeeDetails(product.productId)}
            type="button"
          >
            View Details
          </button>
          {/* Show chat if not logged in or buyer; hide for logged-in farmers */}
          {(!user || user.role === "buyer") && (
            <button
              className="live-chat-btn"
              onClick={() => {
                if (!user) return navigate("/login");
                const status = productLiveStatus[product.productId];
                if (status === false) {
                  window.alert("The farmer is offline, you cannot chat now.");
                  return;
                }
                if (status === undefined || status === "loading") {
                  window.alert(
                    "Checking farmer status. Please try again in a moment."
                  );
                  return;
                }
                // Navigate to dedicated chat page for this product
                navigate(`/chat/${encodeURIComponent(product.productId)}`);
              }}
              title={user ? "Chat with Farmer" : "Login to chat with Farmer"}
              type="button"
            >
              <span
                className={`farmer-status-dot ${
                  productLiveStatus[product.productId] === "loading"
                    ? "loading"
                    : productLiveStatus[product.productId] === true
                    ? "online"
                    : productLiveStatus[product.productId] === false
                    ? "offline"
                    : "unknown"
                }`}
                aria-label={
                  productLiveStatus[product.productId] === true
                    ? "Farmer online"
                    : productLiveStatus[product.productId] === false
                    ? "Farmer offline"
                    : "Status unknown"
                }
              />
              Chat with Farmer
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );

  if (loading || locationLoading) {
    return (
      <div className="products-page">
        <RoleAwareNavbar />
        <main className="content-grow">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading products...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (
    error &&
    typeof error === "string" &&
    (error.toLowerCase().includes("not found") ||
      error === "Unexpected API response format.")
  ) {
    // Try to extract a message from the error or API response
    let apiMessage =
      error === "Unexpected API response format."
        ? "No products found."
        : error;
    return (
      <div className="products-page">
        <RoleAwareNavbar />
        <main className="content-grow">
          <div className="products-container">
            <h1>Our Products</h1>
            <div className="no-products-message">
              <h2>{apiMessage}</h2>
              <p>
                Please{" "}
                <Link to="/add-product" className="add-product-link">
                  add your first product!
                </Link>
              </p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="products-page">
        <RoleAwareNavbar />
        <main className="content-grow">
          <div className="error-container">
            <p>{error}</p>
            <button onClick={fetchProducts} className="retry-button">
              Retry
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="products-page">
      <RoleAwareNavbar />
      <main className="content-grow">
        <div className="products-container full-width">
          <section className="products-hero">
            <div className="hero-text">
              <h2 className="hero-title">Discover Fresh Farm Products</h2>
              <p className="hero-subtitle">
                Search, filter and connect directly with local farmers.
              </p>
            </div>
            <div className="hero-actions">
              <input
                type="text"
                className="search-input"
                placeholder="Search products, city or farmer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select
                className="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="recent">Newest</option>
                <option value="priceLow">Price: Low to High</option>
                <option value="priceHigh">Price: High to Low</option>
                <option value="quantity">Quantity Available</option>
                <option value="distance">Nearest First</option>
              </select>
              <label className="toggle-nearby">
                <input
                  type="checkbox"
                  checked={showNearbyOnly}
                  onChange={(e) => setShowNearbyOnly(e.target.checked)}
                />
                <span>Show Nearby Only</span>
              </label>
              <button
                type="button"
                style={{
                  background: "#ffffff",
                  border: "1px solid #c8dcc9",
                  padding: "0.65rem 1rem",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                }}
                onClick={() => {
                  setSearchTerm("");
                  setSortBy("recent");
                  setShowNearbyOnly(false);
                }}
              >
                Reset Filters
              </button>
            </div>
            {/* Removed total products stat chip per request. Keeping nearby count could be re-added if desired. */}
          </section>

          {orderMessage.text && (
            <div className={`order-message ${orderMessage.type}`}>
              {orderMessage.text}
            </div>
          )}

          {combinedProducts.length === 0 ? (
            <div className="no-products-message">
              <h2>
                {products.length > 0
                  ? "No products match filters"
                  : "No products found"}
              </h2>
              <p>
                {products.length > 0 ? (
                  <>
                    Adjust search / toggle nearby or
                    <button
                      type="button"
                      style={{
                        marginLeft: 8,
                        background: "#2e7d32",
                        color: "#fff",
                        border: "none",
                        padding: "0.5rem 0.9rem",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                      }}
                      onClick={() => {
                        setSearchTerm("");
                        setSortBy("recent");
                        setShowNearbyOnly(false);
                      }}
                    >
                      Reset
                    </button>
                  </>
                ) : (
                  <>
                    Please
                    <Link to="/add-product" className="add-product-link">
                      add your first product!
                    </Link>
                  </>
                )}
              </p>
            </div>
          ) : (
            <>
              <div className="products-grid">
                {displayedProducts.map((product) =>
                  renderProductCard(
                    product,
                    !!nearbyProducts.find(
                      (n) => n.productId === product.productId
                    )
                  )
                )}
              </div>
              {/* Sentinel for infinite scroll */}
              <div ref={sentinelRef} className="infinite-sentinel" />
              {visibleCount < combinedProducts.length && (
                <div className="infinite-loader">Loading more products...</div>
              )}
              {visibleCount >= combinedProducts.length &&
                combinedProducts.length > 0 && (
                  <div className="infinite-loader" style={{ opacity: 0.6 }}>
                    No more products
                  </div>
                )}
            </>
          )}
        </div>
      </main>
      <Footer />
      <GoLiveChatModal open={showGoLive} onClose={() => setShowGoLive(false)} />
      <BuyerFarmerChatModal
        productId={chatProductId}
        open={showBuyerChat}
        onClose={() => setShowBuyerChat(false)}
      />
    </div>
  );
};

// Wrapper export with error boundary so failures don't blank the whole page
const Products = () => (
  <ProductsErrorBoundary>
    <ProductsInner />
  </ProductsErrorBoundary>
);

export default Products;
