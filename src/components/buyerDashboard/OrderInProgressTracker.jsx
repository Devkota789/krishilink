import React, { useEffect, useState, useMemo } from "react";
import { orderAPI, productAPI } from "../../api/api";
import { useNavigate } from "react-router-dom";
import "./OrderInProgressTracker.css";

/*
  OrderInProgressTracker
  - Shows currently active (not completed / rejected) orders for the buyer
  - Progress stages: Ordered -> Confirmed -> Completed
  - Re-fetch lightweight data on mount only (dashboard snapshot)
*/

const ACTIVE_STATUSES = ["pending", "confirmed", "accepted"];

function normalize(raw) {
  if (!raw) return "pending";
  const s = raw.toLowerCase();
  if (["confirmed", "accepted"].includes(s)) return "confirmed";
  if (["completed", "delivered"].includes(s)) return "completed";
  if (["rejected", "cancelled", "canceled", "failed"].includes(s))
    return "rejected";
  return "pending";
}

function stageIndex(status) {
  const n = normalize(status);
  switch (n) {
    case "pending":
      return 0;
    case "confirmed":
      return 1;
    case "completed":
      return 2;
    default:
      return 0;
  }
}

export default function OrderInProgressTracker() {
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
          resp = await orderAPI.getBuyerOrders();
        } catch (e) {
          const st = e?.response?.status;
          if (st === 404) {
            if (mounted) setOrders([]);
            return;
          }
          if (st === 403) {
            resp = await orderAPI.getMyOrders();
          } else throw e;
        }
        const raw = resp?.data || [];
        // Only fetch product names for active ones to reduce calls
        const activeSource = raw.filter((o) => {
          const n = normalize(o.orderStatus || o.status);
          return ACTIVE_STATUSES.includes(n);
        });
        const enriched = await Promise.all(
          activeSource.map(async (o) => {
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
        if (mounted) setError(e.message || "Failed to load active orders");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const activeOrders = useMemo(() => orders, [orders]);

  return (
    <div className="oit-panel">
      <div className="oit-header">
        <h3>Orders In Progress</h3>
        <button className="oit-link" onClick={() => navigate("/my-orders")}>
          Manage
        </button>
      </div>
      {loading && (
        <div className="oit-skeletons">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="oit-skel" />
          ))}
        </div>
      )}
      {!loading && error && <div className="oit-error">{error}</div>}
      {!loading && !error && activeOrders.length === 0 && (
        <div className="oit-empty">No active orders right now.</div>
      )}
      {!loading && !error && activeOrders.length > 0 && (
        <ul className="oit-list">
          {activeOrders.slice(0, 4).map((o) => {
            const status = normalize(o.orderStatus || o.status);
            const idx = stageIndex(status);
            const title = o.product?.productName || o.productName || "Product";
            const stages = ["Ordered", "Confirmed", "Completed"];
            return (
              <li key={o.orderId} className="oit-item">
                <div className="oit-row">
                  <div className="oit-title" title={title}>
                    {title.slice(0, 52)}
                  </div>
                  <span className={`oit-status tag-${status}`}>{status}</span>
                </div>
                <div className="oit-progress" aria-label="order progress">
                  {stages.map((s, i) => {
                    const active = i <= idx;
                    return (
                      <div
                        key={s}
                        className={"oit-step" + (active ? " active" : "")}
                      >
                        <div className="oit-dot" />
                        <span className="oit-step-label">{s}</span>
                        {i < stages.length - 1 && (
                          <div className="oit-connector" />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="oit-actions">
                  <button
                    className="oit-track"
                    onClick={() => navigate("/my-orders")}
                  >
                    Track
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
