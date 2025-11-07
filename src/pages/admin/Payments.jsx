import React, { useEffect, useMemo, useState } from "react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { paymentAPI } from "../../api/api";
import { extractApiErrorMessage } from "../../api/handleApiResponse";
import "./Payments.css";

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

const badgeClass = (status) => {
  if (!status) return "badge";
  const s = String(status).toLowerCase();
  if (s.includes("success") || s.includes("paid") || s.includes("confirmed"))
    return "badge badge-success";
  if (s.includes("init")) return "badge badge-warn";
  if (s.includes("fail") || s.includes("cancel") || s.includes("reject"))
    return "badge badge-danger";
  if (s.includes("refund")) return "badge badge-info";
  return "badge";
};

const methodChipClass = (method) => {
  const m = String(method || "").toLowerCase();
  if (m.includes("khalti")) return "chip chip-khalti";
  if (m.includes("esewa")) return "chip chip-esewa";
  if (m.includes("cash") || m.includes("delivery") || m === "cod")
    return "chip chip-cod";
  return "chip";
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

const Payments = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [payments, setPayments] = useState([]);
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("all");
  const [status, setStatus] = useState("all");
  const [onlyCancelledItems, setOnlyCancelledItems] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());
  const [refunding, setRefunding] = useState(() => ({}));

  const fetchPayments = async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await paymentAPI.getAllPayments();
      if (resp.success) {
        setPayments(Array.isArray(resp.data) ? resp.data : []);
      } else {
        setError(resp.error || resp.message || "Failed to load payments");
      }
    } catch (err) {
      setError(extractApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uniqueMethods = useMemo(() => {
    const s = new Set();
    payments.forEach((p) => p?.paymentMethod && s.add(p.paymentMethod));
    return ["all", ...Array.from(s)];
  }, [payments]);

  const uniqueStatuses = useMemo(() => {
    const s = new Set();
    payments.forEach((p) => p?.status && s.add(p.status));
    return ["all", ...Array.from(s)];
  }, [payments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (method !== "all" && p.paymentMethod !== method) return false;
      if (status !== "all" && p.status !== status) return false;
      if (q) {
        const hay = [
          p.paymentId,
          p.orderId,
          p.userId,
          p.esewa_transaction_code,
          p.khalti_transaction_id,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (onlyCancelledItems) {
        const hasCancelled = (p.orderItems || []).some(
          (it) => String(it.itemStatus).toLowerCase() === "cancelled"
        );
        if (!hasCancelled) return false;
      }
      return true;
    });
  }, [payments, method, status, search, onlyCancelledItems]);

  const toggleExpand = (pid) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(pid)) n.delete(pid);
      else n.add(pid);
      return n;
    });
  };

  const canRefundItem = (payment, it) => {
    const itemStatus = String(it.itemStatus || "").toLowerCase();
    const pstat = String(it.paymentStatus || "").toLowerCase();
    const rstat = String(it.refundStatus || "").toLowerCase();
    const method = String(payment.paymentMethod || "").toLowerCase();
    const isPrepaid = method !== "cashondelivery" && method !== "cod";
    return (
      isPrepaid &&
      itemStatus === "cancelled" &&
      ["paid", "success", "completed"].some((x) => pstat.includes(x)) &&
      (rstat === "none" || rstat === "pending" || rstat === "not_refunded")
    );
  };

  const handleRefund = async (payment, it) => {
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
        await fetchPayments();
      } else {
        alert(resp.error || resp.message || "Refund failed");
      }
    } catch (err) {
      alert(extractApiErrorMessage(err));
    } finally {
      setRefunding((m) => ({ ...m, [id]: false }));
    }
  };

  return (
    <div className="payments-page">
      <Navbar />
      <main className="payments-main">
        <div className="payments-header">
          <div>
            <h1 className="payments-title">Payments</h1>
            <p className="payments-subtitle">
              View all payments across the platform. Expand a row to see order
              items and take actions.
            </p>
          </div>
          <div className="payments-actions">
            <button className="btn" onClick={fetchPayments} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="payments-toolbar">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input"
            placeholder="Search by Payment ID, Order ID, User ID, Txn ID"
          />
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="select"
          >
            {uniqueMethods.map((m) => (
              <option key={m} value={m}>
                {m === "all" ? "All Methods" : m}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="select"
          >
            {uniqueStatuses.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All Statuses" : s}
              </option>
            ))}
          </select>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={onlyCancelledItems}
              onChange={(e) => setOnlyCancelledItems(e.target.checked)}
            />
            <span>Only with cancelled items</span>
          </label>
        </div>

        {error && <div className="error-box">{error}</div>}

        <div className="table-wrap">
          <table className="payments-table">
            <thead>
              <tr>
                <th></th>
                <th>Payment</th>
                <th>Order</th>
                <th>User</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Created</th>
                <th>Confirmed</th>
                <th>Items</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", padding: 24 }}>
                    No payments to show
                  </td>
                </tr>
              )}
              {filtered.map((p) => {
                const pid = p.paymentId;
                const isOpen = expanded.has(pid);
                const items = Array.isArray(p.orderItems) ? p.orderItems : [];
                return (
                  <React.Fragment key={pid}>
                    <tr className="payment-row">
                      <td>
                        <button
                          className="icon-btn"
                          aria-label={isOpen ? "Collapse" : "Expand"}
                          onClick={() => toggleExpand(pid)}
                        >
                          {isOpen ? "▾" : "▸"}
                        </button>
                      </td>
                      <td>
                        <div className="mono">{p.paymentId}</div>
                      </td>
                      <td>
                        <div className="mono">{p.orderId}</div>
                      </td>
                      <td>
                        <div className="mono small">{p.userId}</div>
                      </td>
                      <td>{formatAmount(p.total_amount)}</td>
                      <td>
                        <span className={methodChipClass(p.paymentMethod)}>
                          {p.paymentMethod || "-"}
                        </span>
                      </td>
                      <td>
                        <span className={badgeClass(p.status)}>
                          {p.status || "-"}
                        </span>
                      </td>
                      <td>{toDateStr(p.createdAt)}</td>
                      <td>
                        {p.isConfirmed ? (
                          <span className="badge badge-success">Yes</span>
                        ) : (
                          <span className="badge">No</span>
                        )}
                      </td>
                      <td>{items.length}</td>
                    </tr>
                    {isOpen && (
                      <tr className="items-row">
                        <td></td>
                        <td colSpan={9}>
                          <div className="items-wrap">
                            <table className="items-table">
                              <thead>
                                <tr>
                                  <th>Order Item</th>
                                  <th>Product</th>
                                  <th>Seller</th>
                                  <th>Qty</th>
                                  <th>Rate</th>
                                  <th>Line Total</th>
                                  <th>Item Status</th>
                                  <th>Payment</th>
                                  <th>Refund</th>
                                  <th>Action</th>
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
                                  const allowRefund = canRefundItem(p, it);
                                  return (
                                    <tr key={it.orderItemId}>
                                      <td className="mono small">
                                        {it.orderItemId}
                                      </td>
                                      <td className="mono small">
                                        {it.productId}
                                      </td>
                                      <td className="mono small">
                                        {it.sellerId}
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
                                          className={badgeClass(
                                            it.paymentStatus
                                          )}
                                        >
                                          {it.paymentStatus}
                                        </span>
                                      </td>
                                      <td>
                                        <span
                                          className={badgeClass(
                                            it.refundStatus
                                          )}
                                        >
                                          {it.refundStatus ?? "-"}
                                        </span>
                                      </td>
                                      <td>
                                        <button
                                          className="btn btn-refund"
                                          disabled={
                                            !allowRefund ||
                                            !!refunding[it.orderItemId]
                                          }
                                          onClick={() => handleRefund(p, it)}
                                        >
                                          {refunding[it.orderItemId]
                                            ? "Processing..."
                                            : "Refund"}
                                        </button>
                                      </td>
                                    </tr>
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

export default Payments;
