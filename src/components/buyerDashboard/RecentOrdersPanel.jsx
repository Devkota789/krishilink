import React, { useEffect, useState, useMemo } from "react";
import { orderAPI, productAPI } from "../../api/api";
import { useNavigate } from "react-router-dom";
import "./RecentOrdersPanel.css";

/*
  RecentOrdersPanel
  - Fetches user's orders (lightweight subset)
  - Shows latest 5 orders (sorted by created date desc if available, else orderId)
  - Status pill + total + quick reorder button
*/

const STATUS_COLORS = {
  pending: "#ffb74d",
  confirmed: "#64b5f6",
  accepted: "#64b5f6",
  completed: "#81c784",
  delivered: "#81c784",
  rejected: "#e57373",
  cancelled: "#e57373",
  failed: "#e57373",
};

function normalizeStatus(raw) {
  if (!raw) return "pending";
  const s = raw.toLowerCase();
  if (["confirmed", "accepted"].includes(s)) return "confirmed";
  if (["completed", "delivered"].includes(s)) return "completed";
  if (["rejected", "cancelled", "canceled", "failed"].includes(s))
    return "rejected";
  return "pending";
}

export default function RecentOrdersPanel() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        let resp;
        try {
          // Prefer buyer-specific endpoint
          resp = await orderAPI.getBuyerOrders();
        } catch (e) {
          const status = e?.response?.status;
          if (status === 403) {
            // Forbidden: fallback to generic myOrders
            try {
              resp = await orderAPI.getMyOrders();
            } catch (inner) {
              throw inner;
            }
          } else if (status === 404) {
            // No orders for buyer yet
            if (mounted) setOrders([]);
            return;
          } else {
            throw e;
          }
        }
        const raw = resp?.data || [];
        const enriched = await Promise.all(
          raw.map(async (o) => {
            try {
              const pr = await productAPI.getProductById(o.productId);
              return { ...o, product: pr.data };
            } catch {
              return { ...o, product: null };
            }
          })
        );
        if (!mounted) return;
        setOrders(enriched);
      } catch (e) {
        if (mounted) setError(e.message || "Failed to load recent orders");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const recent = useMemo(() => {
    if (!orders || orders.length === 0) return [];
    const sorted = [...orders].sort((a, b) => {
      const da = new Date(a.createdAt || a.orderDate || 0).getTime();
      const db = new Date(b.createdAt || b.orderDate || 0).getTime();
      return db - da;
    });
    return sorted.slice(0, 5);
  }, [orders]);

  const handleReorder = (o) => {
    if (!o?.productId) return;
    navigate(`/products/${o.productId}`);
  };

  return (
    <div className="recent-orders-panel">
      <div className="rop-header">
        <h3>Recent Orders</h3>
        <button className="rop-link-btn" onClick={() => navigate("/my-orders")}>
          View All
        </button>
      </div>
      {loading && (
        <div className="rop-skeleton-list">
          {Array.from({ length: 3 }).map((_, i) => (
            <div className="rop-skel-row" key={i} />
          ))}
        </div>
      )}
      {!loading && error && <div className="rop-error">{error}</div>}
      {!loading && !error && recent.length === 0 && (
        <div className="rop-empty">
          No orders yet.{" "}
          <button className="rop-cta" onClick={() => navigate("/products")}>
            Shop now
          </button>
        </div>
      )}
      {!loading && !error && recent.length > 0 && (
        <ul className="rop-list">
          {recent.map((o) => {
            const s = normalizeStatus(o.orderStatus || o.status);
            const color = STATUS_COLORS[s] || "#ccc";
            const title = o.product?.productName || o.productName || "Product";
            const qty = o.quantity || o.qty || 1;
            const total =
              o.totalAmount ?? o.total ?? (o.rate && qty ? o.rate * qty : null);
            return (
              <li key={o.orderId} className="rop-item">
                <div className="rop-main">
                  <div className="rop-title" title={title}>
                    {title.slice(0, 50)}
                  </div>
                  <div className="rop-meta">
                    <span className="rop-status" style={{ background: color }}>
                      {s}
                    </span>
                    {total !== null && (
                      <span className="rop-total">₹{total}</span>
                    )}
                  </div>
                </div>
                <div className="rop-actions">
                  <button
                    onClick={() => handleReorder(o)}
                    className="rop-reorder-btn"
                  >
                    Reorder
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
