import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import { extractApiErrorMessage } from "../api/handleApiResponse";
import Navbar from "../components/Navbar";
import DashboardNavbar from "../components/DashboardNavbar";
import Footer from "../components/Footer";
import { useAuth } from "../context/AuthContext";
import "./Cart.css";

// Cart endpoints:
// POST /api/Cart/addToCart { items: [{ productId, quantity }] }
// GET  /api/Cart/getMyCart
// DELETE /api/Cart/removeFromCart?productId=...
// DELETE /api/Cart/clearCart

// Role-aware navbar component
const RoleAwareNavbar = () => {
  const { user } = useAuth();
  return user?.role === "farmer" ? <DashboardNavbar /> : <Navbar />;
};

const Cart = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]); // { productId, productName?, rate?, quantity, imageCode }
  const [cartId, setCartId] = useState(null);
  const [removing, setRemoving] = useState({});
  const [clearing, setClearing] = useState(false);
  const [imageBlobs, setImageBlobs] = useState({}); // productId -> objectURL
  const [productDetailsCache, setProductDetailsCache] = useState({}); // productId -> productImageCode

  // Auth guard
  useEffect(() => {
    const fromEither = (k) =>
      sessionStorage.getItem(k) ?? localStorage.getItem(k);
    const token = fromEither("authToken");
    const exp = fromEither("expiration");
    const refresh = localStorage.getItem("refreshToken");
    // Consider valid if we have a token (session or remembered),
    // or we have a refresh token (remembered sessions can refresh on demand).
    let valid = false;
    if (token) valid = true;
    else if (refresh) valid = true;
    // Optional: if we do have an expiration and it's in the past AND no refresh, redirect
    if (!valid && exp) {
      const t = Date.parse(exp);
      if (!isNaN(t) && Date.now() < t) valid = true;
    }
    if (!valid) navigate("/login", { replace: true });
  }, [navigate]);

  const fetchCart = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const resp = await api.get("/api/Cart/getMyCart");
      // API sample shape:
      // { success:true, data:[ { cartId, items:[ { productId, productName, quantity, rate, price, unit } ] } ] }
      let cartItems = [];
      let cid = null;
      if (Array.isArray(resp.data?.data)) {
        // Flatten all items arrays (usually one cart object)
        resp.data.data.forEach((cart) => {
          if (!cid) {
            cid = cart.cartId || cart.CartId || cart.id || cart.Id || null;
          }
          if (Array.isArray(cart.items)) cartItems.push(...cart.items);
        });
      } else if (Array.isArray(resp.data)) {
        // Fallback if API returns array directly
        cartItems = resp.data;
      } else if (resp.data?.data?.items) {
        const c = resp.data.data;
        cid = c.cartId || c.CartId || c.id || c.Id || null;
        cartItems = resp.data.data.items;
      } else if (resp.data?.items) {
        cartItems = resp.data.items;
      }

      // Normalize & map
      const normalized = cartItems.map((c) => ({
        productId: c.productId,
        quantity: Number(c.quantity || c.qty || 0),
        productName: c.productName || c.name || "Product",
        rate: Number(c.rate || c.price || 0),
        unit: c.unit || "kg",
        productImageCode: c.productImageCode || c.imageCode || null,
      }));
      setItems(normalized);
      if (cid) {
        setCartId(String(cid));
        try {
          sessionStorage.setItem("kl_cartId", String(cid));
          window.__kl_cartId = String(cid);
        } catch {}
      }
      console.log("Cart fetched: items=", normalized.length, normalized);
    } catch (e) {
      const status = e.response?.status;
      if (status === 404) {
        // Treat 404 as empty cart (no error message)
        setItems([]);
        setError(null);
      } else {
        setError(extractApiErrorMessage(e) || "Failed to fetch cart");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // Fetch product details for items that do not yet have a productImageCode
  useEffect(() => {
    const missing = items.filter(
      (it) => !it.productImageCode && !productDetailsCache[it.productId]
    );
    if (!missing.length) return;
    let cancelled = false;
    (async () => {
      try {
        const results = await Promise.all(
          missing.map(async (it) => {
            try {
              const resp = await api.get(
                `/api/Product/getProduct/${it.productId}`
              );
              const data = resp.data?.data || resp.data || {};
              const code =
                data.productImageCode ||
                data.imageCode ||
                data.productImageId ||
                null;
              return { productId: it.productId, code };
            } catch (err) {
              console.warn(
                "Failed to fetch product details",
                it.productId,
                err?.message
              );
              return { productId: it.productId, code: null };
            }
          })
        );
        if (cancelled) return;
        const updates = {};
        const mapCodes = {};
        results.forEach((r) => {
          if (r && r.code) {
            mapCodes[r.productId] = r.code;
          }
        });
        if (Object.keys(mapCodes).length) {
          setItems((prev) =>
            prev.map((it) =>
              mapCodes[it.productId]
                ? { ...it, productImageCode: mapCodes[it.productId] }
                : it
            )
          );
          setProductDetailsCache((prev) => ({ ...prev, ...mapCodes }));
        } else {
          // mark looked up to avoid repeat attempts even if no code
          const looked = {};
          results.forEach((r) => (looked[r.productId] = r.code || false));
          setProductDetailsCache((prev) => ({ ...prev, ...looked }));
        }
      } catch (e) {
        console.warn("Bulk product details fetch error", e?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [items, productDetailsCache]);

  // Fetch images for items that have an image code and not yet loaded
  useEffect(() => {
    const abort = new AbortController();
    const loadImages = async () => {
      for (const it of items) {
        if (!it.productImageCode) continue;
        if (imageBlobs[it.productId]) continue; // already loaded
        try {
          const resp = await api.get(
            `/api/Product/getProductImage/${it.productImageCode}`,
            {
              responseType: "blob",
              signal: abort.signal,
            }
          );
          const url = URL.createObjectURL(resp.data);
          setImageBlobs((prev) => ({ ...prev, [it.productId]: url }));
        } catch (err) {
          // Silent fail; keep placeholder
          console.warn(
            "Image load failed for product",
            it.productId,
            err?.message
          );
        }
      }
    };
    if (items.length) loadImages();
    return () => abort.abort();
  }, [items, imageBlobs]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(imageBlobs).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imageBlobs]);

  const total = useMemo(
    () => items.reduce((sum, i) => sum + (i.rate || 0) * i.quantity, 0),
    [items]
  );

  const updateQuantity = async (productId, newQty) => {
    if (newQty < 1) return;
    setUpdating(true);
    try {
      await api.post("/api/Cart/addToCart", {
        items: [{ productId, quantity: newQty }],
      });
      setItems((prev) =>
        prev.map((it) =>
          it.productId === productId ? { ...it, quantity: newQty } : it
        )
      );
    } catch (e) {
      setError(extractApiErrorMessage(e) || "Failed to update item");
    } finally {
      setUpdating(false);
    }
  };

  // Increment: use addToCart with quantity 1 (API expected to add / merge)
  const incrementItem = async (productId) => {
    setUpdating(true);
    try {
      await api.post("/api/Cart/addToCart", {
        items: [{ productId, quantity: 1 }],
      });
      setItems((prev) =>
        prev.map((it) =>
          it.productId === productId ? { ...it, quantity: it.quantity + 1 } : it
        )
      );
    } catch (e) {
      setError(extractApiErrorMessage(e) || "Failed to increase quantity");
    } finally {
      setUpdating(false);
    }
  };

  // Decrement: use removeFromCart endpoint (API specified by user). If quantity becomes 0, remove item from list.
  const decrementItem = async (productId) => {
    const current = items.find((i) => i.productId === productId);
    if (!current) return;
    if (current.quantity <= 0) return;
    setUpdating(true);
    try {
      await api.delete(`/api/Cart/removeFromCart`, { params: { productId } });
      setItems((prev) =>
        prev
          .map((it) =>
            it.productId === productId
              ? { ...it, quantity: it.quantity - 1 }
              : it
          )
          .filter((it) => it.quantity > 0)
      );
    } catch (e) {
      setError(extractApiErrorMessage(e) || "Failed to decrease quantity");
    } finally {
      setUpdating(false);
    }
  };

  const removeItem = async (productId) => {
    const current = items.find((i) => i.productId === productId);
    if (!current) return;
    const count = Number(current.quantity || 0);
    if (count <= 0) return;
    setRemoving((r) => ({ ...r, [productId]: true }));
    try {
      // Trigger DELETE once per quantity to remove the whole item from cart
      for (let i = 0; i < count; i++) {
        await api.delete(`/api/Cart/removeFromCart`, { params: { productId } });
      }
      // Optimistically remove item from state
      setItems((prev) => prev.filter((i) => i.productId !== productId));
    } catch (e) {
      // If any call fails, resync the cart to reflect server truth
      setError(extractApiErrorMessage(e) || "Failed to remove item");
      try {
        await fetchCart();
      } catch {}
    } finally {
      setRemoving((r) => ({ ...r, [productId]: false }));
    }
  };

  const clearCart = async () => {
    if (!items.length) return;
    setClearing(true);
    try {
      await api.delete("/api/Cart/clearCart");
      setItems([]);
    } catch (e) {
      setError(extractApiErrorMessage(e) || "Failed to clear cart");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="cart-page">
      <RoleAwareNavbar />
      <div className="cart-container">
        <h1 className="cart-title">My Cart</h1>
        {error && <div className="cart-error">{error}</div>}
        {loading ? (
          <div className="cart-loading">Loading cart...</div>
        ) : items.length === 0 ? (
          <div className="cart-empty">Your cart is empty.</div>
        ) : (
          <div className="cart-grid">
            <div className="cart-items">
              {items.map((item) => {
                const imgSrc = imageBlobs[item.productId];
                const initials = item.productName
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase();
                return (
                  <div key={item.productId} className="cart-item">
                    <div className="cart-item-main">
                      <div className="cart-item-thumb">
                        {imgSrc ? (
                          <img src={imgSrc} alt={item.productName} />
                        ) : (
                          initials || "P"
                        )}
                      </div>
                      <div className="cart-item-info">
                        <div className="cart-item-name">{item.productName}</div>
                        <div className="cart-item-meta">
                          ₹{item.rate} / {item.unit}
                        </div>
                      </div>
                    </div>
                    <div className="cart-item-actions">
                      <div className="qty-control">
                        <button
                          disabled={updating || item.quantity <= 0}
                          onClick={() => decrementItem(item.productId)}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          readOnly
                          disabled={updating}
                        />
                        <button
                          disabled={updating}
                          onClick={() => incrementItem(item.productId)}
                        >
                          +
                        </button>
                      </div>
                      <button
                        className="remove-btn"
                        disabled={removing[item.productId]}
                        onClick={() => removeItem(item.productId)}
                      >
                        {removing[item.productId] ? "Removing..." : "Remove"}
                      </button>
                    </div>
                    <div className="cart-item-subtotal">
                      ₹{(item.rate || 0) * item.quantity}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="cart-summary">
              <h2>Summary</h2>
              <div className="summary-row">
                <span>Items</span>
                <span>{items.length}</span>
              </div>
              <div className="summary-row">
                <span>Total</span>
                <span className="summary-total">₹{total.toFixed(2)}</span>
              </div>
              <button
                className="clear-btn"
                onClick={clearCart}
                disabled={clearing || !items.length}
              >
                {clearing ? "Clearing..." : "Clear Cart"}
              </button>
              <button
                className="checkout-btn"
                disabled={!items.length}
                onClick={() =>
                  navigate("/checkout", {
                    state: {
                      cartId: cartId || sessionStorage.getItem("kl_cartId"),
                    },
                  })
                }
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default Cart;
