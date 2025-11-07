import React, { useEffect, useState, useMemo } from "react";
import api from "../../api/api";
import { useNavigate } from "react-router-dom";
import "./CartSnapshot.css";

// Lightweight cart summary panel for buyer dashboard
// Shows first few items, subtotal, and quick actions
export default function CartSnapshot() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]); // { productId, productName, quantity, rate, unit, productImageCode }
  const [imageUrls, setImageUrls] = useState({}); // productId -> blob url
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const resp = await api.get("/api/Cart/getMyCart");
        let cartItems = [];
        const root = resp.data;
        if (Array.isArray(root?.data)) {
          root.data.forEach(
            (c) => Array.isArray(c.items) && cartItems.push(...c.items)
          );
        } else if (Array.isArray(root)) {
          cartItems = root;
        } else if (Array.isArray(root?.data?.items)) {
          cartItems = root.data.items;
        } else if (Array.isArray(root?.items)) {
          cartItems = root.items;
        }
        const normalized = cartItems
          .map((c) => ({
            productId: c.productId,
            productName: c.productName || c.name || "Product",
            quantity: Number(c.quantity || c.qty || 0),
            rate: Number(c.rate || c.price || 0),
            unit: c.unit || "kg",
            productImageCode: c.productImageCode || c.imageCode || null,
          }))
          .filter((it) => it.quantity > 0);
        if (!cancelled) setItems(normalized);
      } catch (e) {
        const status = e?.response?.status;
        if (status === 404) {
          if (!cancelled) setItems([]); // empty cart
        } else {
          if (!cancelled) setError(e.message || "Failed to load cart");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch images (best-effort, skip errors)
  useEffect(() => {
    const abort = new AbortController();
    (async () => {
      for (const it of items.slice(0, 4)) {
        // only fetch visible few
        if (!it.productImageCode) continue;
        if (imageUrls[it.productId]) continue;
        try {
          const resp = await api.get(
            `/api/Product/getProductImage/${it.productImageCode}`,
            { responseType: "blob", signal: abort.signal }
          );
          const url = URL.createObjectURL(resp.data);
          setImageUrls((prev) => ({ ...prev, [it.productId]: url }));
        } catch (_) {}
      }
    })();
    return () => {
      abort.abort();
      Object.values(imageUrls).forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + (i.rate || 0) * i.quantity, 0),
    [items]
  );

  const visible = items.slice(0, 4);
  const remaining = Math.max(0, items.length - visible.length);

  return (
    <div className="cart-snapshot-card">
      <div className="cart-snapshot-header">
        <span role="img" aria-label="cart">
          🛒
        </span>
        <h3>Cart Snapshot</h3>
      </div>
      {loading && (
        <div className="cart-snapshot-loading">
          <div className="line shimmer" style={{ width: "70%" }} />
          <div className="line shimmer" style={{ width: "55%" }} />
          <div className="line shimmer" style={{ width: "40%" }} />
        </div>
      )}
      {!loading && error && <div className="cart-snapshot-error">{error}</div>}
      {!loading && !error && !items.length && (
        <div className="cart-snapshot-empty">Your cart is empty.</div>
      )}
      {!loading && !error && !!items.length && (
        <>
          <ul className="cart-snapshot-list">
            {visible.map((it) => {
              const initials = it.productName
                .split(/\s+/)
                .slice(0, 2)
                .map((w) => w[0])
                .join("")
                .toUpperCase();
              const img = imageUrls[it.productId];
              return (
                <li
                  key={it.productId}
                  className="cart-snapshot-item"
                  onClick={() => navigate(`/product-details/${it.productId}`)}
                >
                  <div className="thumb">
                    {img ? <img src={img} alt={it.productName} /> : initials}
                  </div>
                  <div className="meta">
                    <div className="name" title={it.productName}>
                      {it.productName}
                    </div>
                    <div className="qtyPrice">
                      {it.quantity} x ₹{it.rate} / {it.unit}
                    </div>
                  </div>
                  <div className="lineTotal">
                    ₹{((it.rate || 0) * it.quantity).toFixed(2)}
                  </div>
                </li>
              );
            })}
          </ul>
          {remaining > 0 && (
            <div className="more-indicator">
              +{remaining} more item{remaining > 1 ? "s" : ""}
            </div>
          )}
          <div className="cart-snapshot-footer">
            <div className="subtotal">
              <span>Subtotal</span>
              <strong>₹{subtotal.toFixed(2)}</strong>
            </div>
            <div className="actions">
              <button
                className="view-cart-btn"
                onClick={() => navigate("/cart")}
              >
                View Cart
              </button>
              <button
                className="checkout-btn"
                disabled={!items.length}
                onClick={() => navigate("/cart")}
              >
                Checkout
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
