import React, { useEffect, useMemo, useState } from "react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { orderAPI, paymentAPI, productAPI } from "../../api/api";
import { extractApiErrorMessage } from "../../api/handleApiResponse";
import "./AdminOrders.css";

// Lightweight image cache to stabilize product thumbnails across re-renders
const IMG_CACHE_PREFIX = "kl_img_"; // key: kl_img_<code>
const IMG_CACHE_INDEX = "kl_img_index"; // JSON array of { code, ts }
const IMG_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days TTL
const IMG_CACHE_MAX = 200; // cap entries to avoid blowing up localStorage
const imageMemoryCache = new Map(); // in-memory dataURL cache for fast lookups

function lsGet(k) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function lsSet(k, v) {
  try {
    localStorage.setItem(k, v);
  } catch {
    // ignore quota errors
  }
}
function lsRemove(k) {
  try {
    localStorage.removeItem(k);
  } catch {}
}
function getIndex() {
  try {
    const raw = lsGet(IMG_CACHE_INDEX);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function setIndex(arr) {
  try {
    lsSet(IMG_CACHE_INDEX, JSON.stringify(arr));
  } catch {}
}
function pruneIfNeeded() {
  const idx = getIndex();
  const now = Date.now();
  // filter out expired
  let next = idx.filter((e) => now - (e.ts || 0) < IMG_CACHE_TTL_MS);
  // trim to max
  if (next.length > IMG_CACHE_MAX) {
    next.sort((a, b) => (a.ts || 0) - (b.ts || 0));
    const remove = next.slice(0, next.length - IMG_CACHE_MAX);
    remove.forEach((e) => lsRemove(IMG_CACHE_PREFIX + e.code));
    next = next.slice(next.length - IMG_CACHE_MAX);
  }
  setIndex(next);
}
function getCachedImage(code) {
  if (!code) return null;
  // memory first
  if (imageMemoryCache.has(code)) return imageMemoryCache.get(code) || null;
  // then localStorage
  try {
    const raw = lsGet(IMG_CACHE_PREFIX + code);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.dataUrl) return null;
    // TTL check
    if (Date.now() - (obj.ts || 0) > IMG_CACHE_TTL_MS) {
      lsRemove(IMG_CACHE_PREFIX + code);
      return null;
    }
    imageMemoryCache.set(code, obj.dataUrl);
    return obj.dataUrl;
  } catch {
    return null;
  }
}
function setCachedImage(code, dataUrl) {
  if (!code || !dataUrl) return;
  imageMemoryCache.set(code, dataUrl);
  const record = { code, ts: Date.now(), dataUrl };
  try {
    lsSet(IMG_CACHE_PREFIX + code, JSON.stringify(record));
    // update index
    const idx = getIndex().filter((e) => e.code !== code);
    idx.push({ code, ts: record.ts });
    setIndex(idx);
    pruneIfNeeded();
  } catch {
    // ignore if quota exceeded
  }
}

function toDateStr(s) {
  if (!s) return "-";
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleString();
  } catch {
    return s;
  }
}

function formatAmount(v) {
  if (v == null) return "-";
  const num = typeof v === "string" ? Number(v) : v;
  if (Number.isNaN(num)) return String(v);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "NPR",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 2,
  }).format(num);
}

// Generic badge mapping (used for payment/refund where colors differ)
const statusBadge = (s) => {
  const v = String(s || "").toLowerCase();
  if (["paid", "success", "delivered", "completed"].some((k) => v.includes(k)))
    return "badge badge-success";
  if (["pending", "init"].some((k) => v.includes(k))) return "badge badge-warn";
  if (["fail", "reject", "cancel"].some((k) => v.includes(k)))
    return "badge badge-danger";
  if (["refund"].some((k) => v.includes(k))) return "badge badge-info";
  return "badge";
};

// Order/Item Status mapping per spec:
// Processing=gray, Confirmed=blue, Shipped=orange, Delivered=green, Cancelled=red
const orderStatusBadge = (s) => {
  const v = String(s || "").toLowerCase();
  if (v.includes("process")) return "badge badge-processing";
  if (v.includes("confirm")) return "badge badge-confirm";
  if (v.includes("ship")) return "badge badge-ship";
  if (v.includes("deliver")) return "badge badge-success";
  if (v.includes("cancel")) return "badge badge-danger";
  return "badge";
};

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [overall, setOverall] = useState("all");
  const [itemStatus, setItemStatus] = useState("all");
  const [expanded, setExpanded] = useState(() => new Set());
  const [refunding, setRefunding] = useState(() => ({}));
  const [itemBusy, setItemBusy] = useState(() => ({}));
  const [orderBusy, setOrderBusy] = useState(() => ({}));
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchOrders = async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await orderAPI.getAllOrders();
      if (resp.success) {
        const arr = Array.isArray(resp.data) ? resp.data : [];
        setOrders(arr);
      } else {
        setError(resp.error || resp.message || "Failed to load orders");
      }
    } catch (err) {
      setError(extractApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const uniqueOverall = useMemo(() => {
    const s = new Set();
    orders.forEach((o) => o?.overallStatus && s.add(o.overallStatus));
    return ["all", ...Array.from(s)];
  }, [orders]);

  const uniqueItemStatuses = useMemo(() => {
    const s = new Set();
    orders.forEach((o) =>
      (o.orderItems || []).forEach(
        (it) => it?.itemStatus && s.add(it.itemStatus)
      )
    );
    return ["all", ...Array.from(s)];
  }, [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (overall !== "all" && String(o.overallStatus) !== overall)
        return false;
      if (itemStatus !== "all") {
        const has = (o.orderItems || []).some(
          (it) => String(it.itemStatus) === itemStatus
        );
        if (!has) return false;
      }
      if (dateFrom) {
        const from = Date.parse(dateFrom);
        if (!Number.isNaN(from)) {
          const od = Date.parse(o.orderDate);
          if (!Number.isNaN(od) && od < from) return false;
        }
      }
      if (dateTo) {
        const to = Date.parse(dateTo);
        if (!Number.isNaN(to)) {
          const od = Date.parse(o.orderDate);
          if (!Number.isNaN(od) && od > to + 86400000 - 1) return false;
        }
      }
      if (q) {
        const hay = [o.orderId, o.buyerId]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, overall, itemStatus, search, dateFrom, dateTo]);

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const canRefundItem = (it) => {
    const itemStatus = String(it.itemStatus || "").toLowerCase();
    const pstat = String(it.paymentStatus || "").toLowerCase();
    const rstat = String(it.refundStatus || "").toLowerCase();
    const isPrepaid = pstat !== "cod" && !pstat.includes("cash");
    return (
      isPrepaid &&
      itemStatus === "cancelled" &&
      ["paid", "success", "completed"].some((x) => pstat.includes(x)) &&
      (rstat === "none" || rstat === "pending" || rstat === "not_refunded")
    );
  };

  const handleRefund = async (it) => {
    const id = it.orderItemId;
    if (!id) return;
    const confirmed = window.confirm(
      "Refund this order item? This will attempt to process a refund via backend."
    );
    if (!confirmed) return;
    setRefunding((m) => ({ ...m, [id]: true }));
    try {
      const resp = await paymentAPI.refundOrderItem(id);
      if (resp.success) {
        alert("Refund initiated successfully.");
        await fetchOrders();
      } else {
        alert(resp.error || resp.message || "Refund failed");
      }
    } catch (err) {
      alert(extractApiErrorMessage(err));
    } finally {
      setRefunding((m) => ({ ...m, [id]: false }));
    }
  };

  // Image renderer that fetches via API (so Authorization header is included)
  const OrderItemImage = ({ code, alt }) => {
    const [src, setSrc] = useState(null);
    useEffect(() => {
      let objectUrl = null;
      let cancelled = false;
      if (!code) {
        setSrc(null);
        return;
      }
      // Try cache first
      const cached = getCachedImage(code);
      if (cached) {
        setSrc(cached);
        // no need to fetch immediately; leave it unless you want a background refresh
      } else {
        (async () => {
          try {
            const resp = await productAPI.getProductImage(code);
            const blob = resp?.data;
            if (!blob) return;
            // Convert blob to dataURL so we can persist and keep stable across rerenders
            const reader = new FileReader();
            reader.onloadend = () => {
              const dataUrl =
                typeof reader.result === "string" ? reader.result : null;
              if (!dataUrl) return;
              if (!cancelled) setSrc(dataUrl);
              setCachedImage(code, dataUrl);
            };
            reader.readAsDataURL(blob);
          } catch {
            if (!cancelled) setSrc(null);
          }
        })();
      }
      return () => {
        cancelled = true;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    }, [code]);
    return (
      <div className="item-img-wrap" title={alt}>
        {src ? (
          <img className="item-img" src={src} alt={alt || "Product"} />
        ) : (
          <div className="item-img placeholder">No image</div>
        )}
      </div>
    );
  };

  // Item-level actions wired to backend
  const handleConfirmItem = async (order, it) => {
    const id = it?.orderItemId;
    if (!id) return;
    setItemBusy((m) => ({ ...m, [id]: true }));
    try {
      const resp = await orderAPI.confirmOrderItem(id);
      if (resp?.success) {
        await fetchOrders();
      } else {
        alert(resp?.error || resp?.message || "Failed to confirm item");
      }
    } catch (err) {
      alert(extractApiErrorMessage(err));
    } finally {
      setItemBusy((m) => ({ ...m, [id]: false }));
    }
  };

  const handleShipItem = async (order, it) => {
    const id = it?.orderItemId;
    if (!id) return;
    setItemBusy((m) => ({ ...m, [id]: true }));
    try {
      const resp = await orderAPI.shipOrderItem(id);
      if (resp?.success) {
        await fetchOrders();
      } else {
        alert(resp?.error || resp?.message || "Failed to ship item");
      }
    } catch (err) {
      alert(extractApiErrorMessage(err));
    } finally {
      setItemBusy((m) => ({ ...m, [id]: false }));
    }
  };

  const handleDeliverItem = async (order, it) => {
    const id = it?.orderItemId;
    if (!id) return;
    setItemBusy((m) => ({ ...m, [id]: true }));
    try {
      const resp = await orderAPI.deliverOrderItem(id);
      if (resp?.success) {
        await fetchOrders();
      } else {
        alert(resp?.error || resp?.message || "Failed to mark delivered");
      }
    } catch (err) {
      alert(extractApiErrorMessage(err));
    } finally {
      setItemBusy((m) => ({ ...m, [id]: false }));
    }
  };

  const handleMarkAsDelivery = async (order, it) => {
    const id = it?.orderItemId;
    if (!id) return;
    setItemBusy((m) => ({ ...m, [id]: true }));
    try {
      const resp = await orderAPI.markAsDelivery(id);
      if (resp?.success) {
        await fetchOrders();
      } else {
        alert(resp?.error || resp?.message || "Failed to confirm delivery");
      }
    } catch (err) {
      alert(extractApiErrorMessage(err));
    } finally {
      setItemBusy((m) => ({ ...m, [id]: false }));
    }
  };

  const handleCancelItem = async (order, it) => {
    const id = it?.orderItemId;
    if (!id || !order?.orderId) return;
    const ok = window.confirm("Cancel this order item?");
    if (!ok) return;
    setItemBusy((m) => ({ ...m, [id]: true }));
    try {
      const resp = await orderAPI.cancelOrderItem(order.orderId, id);
      if (resp?.success) {
        await fetchOrders();
      } else {
        alert(resp?.error || resp?.message || "Failed to cancel item");
      }
    } catch (err) {
      alert(extractApiErrorMessage(err));
    } finally {
      setItemBusy((m) => ({ ...m, [id]: false }));
    }
  };

  // Order-level bulk actions
  const bulkShipAll = async (order) => {
    if (!order?.orderItems?.length) return;
    const id = order.orderId;
    setOrderBusy((m) => ({ ...m, [id]: true }));
    try {
      // Ship all items sequentially to surface first error
      for (const it of order.orderItems) {
        if (!it?.orderItemId) continue;
        const r = await orderAPI.shipOrderItem(it.orderItemId);
        if (!r?.success) {
          throw new Error(
            r?.error || r?.message || `Failed to ship ${it.orderItemId}`
          );
        }
      }
      await fetchOrders();
    } catch (err) {
      alert(extractApiErrorMessage(err));
    } finally {
      setOrderBusy((m) => ({ ...m, [id]: false }));
    }
  };

  const bulkDeliverAll = async (order) => {
    if (!order?.orderItems?.length) return;
    const id = order.orderId;
    setOrderBusy((m) => ({ ...m, [id]: true }));
    try {
      for (const it of order.orderItems) {
        if (!it?.orderItemId) continue;
        const r = await orderAPI.deliverOrderItem(it.orderItemId);
        if (!r?.success) {
          throw new Error(
            r?.error || r?.message || `Failed to deliver ${it.orderItemId}`
          );
        }
      }
      await fetchOrders();
    } catch (err) {
      alert(extractApiErrorMessage(err));
    } finally {
      setOrderBusy((m) => ({ ...m, [id]: false }));
    }
  };

  const bulkCancelOrder = async (order) => {
    if (!order?.orderItems?.length) return;
    const id = order.orderId;
    const ok = window.confirm(
      "Cancel this entire order? All items will be cancelled."
    );
    if (!ok) return;
    setOrderBusy((m) => ({ ...m, [id]: true }));
    try {
      for (const it of order.orderItems) {
        if (!it?.orderItemId) continue;
        const r = await orderAPI.cancelOrderItem(order.orderId, it.orderItemId);
        if (!r?.success) {
          throw new Error(
            r?.error || r?.message || `Failed to cancel ${it.orderItemId}`
          );
        }
      }
      await fetchOrders();
    } catch (err) {
      alert(extractApiErrorMessage(err));
    } finally {
      setOrderBusy((m) => ({ ...m, [id]: false }));
    }
  };

  return (
    <div className="orders-page">
      <Navbar />
      <main className="orders-main">
        <div className="orders-header">
          <div>
            <h1 className="orders-title">Orders</h1>
            <p className="orders-subtitle">
              View and manage all orders across the platform. Expand a row to
              see items and actions.
            </p>
          </div>
          <div className="orders-actions">
            <button className="btn" onClick={fetchOrders} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="orders-toolbar">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input"
            placeholder="Search by Order ID or Buyer ID"
          />
          <select
            value={overall}
            onChange={(e) => setOverall(e.target.value)}
            className="select"
          >
            {uniqueOverall.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All Overall Status" : s}
              </option>
            ))}
          </select>
          <select
            value={itemStatus}
            onChange={(e) => setItemStatus(e.target.value)}
            className="select"
          >
            {uniqueItemStatuses.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All Item Status" : s}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="input"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <input
            type="date"
            className="input"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>

        {error && <div className="error-box">{error}</div>}

        <div className="table-wrap">
          <table className="orders-table">
            <thead>
              <tr>
                <th></th>
                <th>Order</th>
                <th>Buyer</th>
                <th>Total</th>
                <th>Status</th>
                <th>Ordered Date</th>
                <th>Updated</th>
                <th>Items</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: 24 }}>
                    No orders to show
                  </td>
                </tr>
              )}
              {filtered.map((o) => {
                const id = o.orderId;
                const isOpen = expanded.has(id);
                const items = Array.isArray(o.orderItems) ? o.orderItems : [];
                return (
                  <React.Fragment key={id}>
                    <tr className="order-row">
                      <td>
                        <button
                          className="icon-btn"
                          aria-label={isOpen ? "Collapse" : "Expand"}
                          onClick={() => toggleExpand(id)}
                        >
                          {isOpen ? "▾" : "▸"}
                        </button>
                      </td>
                      <td>
                        <div className="mono">{o.orderId}</div>
                      </td>
                      <td>
                        <div className="mono small">{o.buyerId}</div>
                      </td>
                      <td>{formatAmount(o.totalAmount)}</td>
                      <td>
                        <span className={orderStatusBadge(o.overallStatus)}>
                          {o.overallStatus || "-"}
                        </span>
                      </td>
                      <td>{toDateStr(o.orderDate)}</td>
                      <td>{toDateStr(o.updatedAt)}</td>
                      <td>{items.length}</td>
                      <td style={{ textAlign: "right" }}>
                        <div className="row-actions">
                          <button
                            className="btn btn-view"
                            onClick={() => toggleExpand(id)}
                          >
                            {isOpen ? "Hide" : "View"}
                          </button>
                          <div className="dropdown">
                            <button
                              className="btn btn-more"
                              disabled={!!orderBusy[id]}
                            >
                              Manage ▾
                            </button>
                            <div className="menu">
                              <button
                                className="menu-btn menu-processing"
                                onClick={() =>
                                  alert(
                                    "Mark Processing is not supported by API yet."
                                  )
                                }
                              >
                                Mark Processing
                              </button>
                              <button
                                className="menu-btn menu-ship"
                                disabled={!!orderBusy[id]}
                                onClick={() => bulkShipAll(o)}
                              >
                                Ship All Items
                              </button>
                              <button
                                className="menu-btn menu-deliver"
                                disabled={!!orderBusy[id]}
                                onClick={() => bulkDeliverAll(o)}
                              >
                                Deliver All Items
                              </button>
                              <button
                                className="menu-btn menu-cancel"
                                disabled={!!orderBusy[id]}
                                onClick={() => bulkCancelOrder(o)}
                              >
                                Cancel Order
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="items-row">
                        <td></td>
                        <td colSpan={8}>
                          <div className="items-wrap">
                            <table className="items-table">
                              <thead>
                                <tr>
                                  <th>Item</th>
                                  <th>Product</th>
                                  <th>Image</th>
                                  <th>Qty</th>
                                  <th>Rate</th>
                                  <th>Line Total</th>
                                  <th>Item Status</th>
                                  <th>Payment</th>
                                  <th>Refund</th>
                                  <th style={{ textAlign: "right" }}>
                                    Actions
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.length === 0 && (
                                  <tr>
                                    <td
                                      colSpan={10}
                                      style={{
                                        textAlign: "center",
                                        padding: 16,
                                      }}
                                    >
                                      No items
                                    </td>
                                  </tr>
                                )}
                                {items.map((it) => {
                                  // Prefer newly provided backend fields, then fall back to older variants
                                  const sellerName =
                                    it?.farmerName ??
                                    it?.Product?.FarmerName ??
                                    it?.product?.FarmerName ??
                                    it?.product?.farmerName ??
                                    it?.FarmerName ??
                                    it?.sellerName ??
                                    "-";
                                  const sellerPhone =
                                    it?.farmerPhone ??
                                    it?.Seller?.PhoneNumber ??
                                    it?.seller?.PhoneNumber ??
                                    it?.seller?.phoneNumber ??
                                    it?.Product?.User?.PhoneNumber ??
                                    it?.product?.user?.PhoneNumber ??
                                    it?.product?.user?.phoneNumber ??
                                    it?.product?.phoneNumber ??
                                    it?.sellerPhone ??
                                    "-";
                                  const buyerName =
                                    it?.buyerName ??
                                    it?.Order?.Buyer?.FullName ??
                                    it?.order?.buyer?.FullName ??
                                    it?.order?.buyer?.fullName ??
                                    o?.BuyerName ??
                                    o?.buyerName ??
                                    o?.buyer?.FullName ??
                                    o?.buyer?.fullName ??
                                    "-";
                                  const buyerPhone =
                                    it?.buyerPhone ??
                                    it?.Order?.Buyer?.PhoneNumber ??
                                    it?.order?.buyer?.PhoneNumber ??
                                    it?.order?.buyer?.phoneNumber ??
                                    o?.BuyerPhone ??
                                    o?.buyerPhone ??
                                    o?.buyer?.PhoneNumber ??
                                    o?.buyer?.phoneNumber ??
                                    "-";
                                  return (
                                    <React.Fragment key={it.orderItemId}>
                                      <tr>
                                        <td className="mono small">
                                          {it.orderItemId}
                                        </td>
                                        <td className="mono small">
                                          {it.productId}
                                        </td>
                                        <td>
                                          <OrderItemImage
                                            code={
                                              it.productImageCode ||
                                              it.imageCode ||
                                              it.productImage ||
                                              null
                                            }
                                            alt={String(it.productId || "")}
                                          />
                                        </td>
                                        <td>{it.quantity}</td>
                                        <td>{formatAmount(it.rate)}</td>
                                        <td>{formatAmount(it.totalPrice)}</td>
                                        <td>
                                          <span
                                            className={orderStatusBadge(
                                              it.itemStatus
                                            )}
                                          >
                                            {it.itemStatus}
                                          </span>
                                        </td>
                                        <td>
                                          <span
                                            className={statusBadge(
                                              it.paymentStatus
                                            )}
                                          >
                                            {it.paymentStatus}
                                          </span>
                                        </td>
                                        <td>
                                          <span
                                            className={statusBadge(
                                              it.refundStatus
                                            )}
                                          >
                                            {it.refundStatus ?? "-"}
                                          </span>
                                        </td>
                                        <td style={{ textAlign: "right" }}>
                                          <div className="row-actions">
                                            <button
                                              className="btn btn-confirm"
                                              disabled={
                                                !!itemBusy[it.orderItemId]
                                              }
                                              onClick={() =>
                                                handleConfirmItem(o, it)
                                              }
                                            >
                                              Confirm
                                            </button>
                                            <button
                                              className="btn btn-ship"
                                              disabled={
                                                !!itemBusy[it.orderItemId]
                                              }
                                              onClick={() =>
                                                handleShipItem(o, it)
                                              }
                                            >
                                              Ship
                                            </button>
                                            <button
                                              className="btn btn-deliver"
                                              disabled={
                                                !!itemBusy[it.orderItemId]
                                              }
                                              onClick={() =>
                                                handleDeliverItem(o, it)
                                              }
                                            >
                                              Delivered
                                            </button>
                                            <button
                                              className="btn btn-deliver"
                                              disabled={
                                                !!itemBusy[it.orderItemId]
                                              }
                                              onClick={() =>
                                                handleMarkAsDelivery(o, it)
                                              }
                                            >
                                              Mark ✓ As Delivered
                                            </button>
                                            <button
                                              className="btn btn-cancel"
                                              disabled={
                                                !!itemBusy[it.orderItemId]
                                              }
                                              onClick={() =>
                                                handleCancelItem(o, it)
                                              }
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              className="btn btn-refund"
                                              disabled={
                                                !canRefundItem(it) ||
                                                !!refunding[it.orderItemId]
                                              }
                                              onClick={() => handleRefund(it)}
                                            >
                                              {refunding[it.orderItemId]
                                                ? "Processing..."
                                                : "Refund"}
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                      <tr className="item-subrow">
                                        <td colSpan={10}>
                                          <div className="subrow-meta">
                                            <div className="meta-block">
                                              <span className="label">
                                                Farmer:
                                              </span>
                                              <span className="value">
                                                {sellerName}
                                              </span>
                                              <span className="sep">•</span>
                                              <span className="value mono small">
                                                {sellerPhone}
                                              </span>
                                            </div>
                                            <div className="meta-block">
                                              <span className="label">
                                                Buyer:
                                              </span>
                                              <span className="value">
                                                {buyerName}
                                              </span>
                                              <span className="sep">•</span>
                                              <span className="value mono small">
                                                {buyerPhone}
                                              </span>
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                    </React.Fragment>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AdminOrders;
