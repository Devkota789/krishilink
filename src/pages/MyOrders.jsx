import React, { useState, useEffect } from "react";
import { orderAPI, productAPI } from "../api/api";
import Navbar from "../components/Navbar";
import DashboardNavbar from "../components/DashboardNavbar";
import Footer from "../components/Footer";
import { useAuth } from "../context/AuthContext";
import { FaBox, FaEye, FaChevronDown, FaChevronUp } from "react-icons/fa";
import "./MyOrders.css";

const MyOrders = () => {
  // Role-aware navbar
  const RoleAwareNavbar = () => {
    const { user } = useAuth();
    return user?.role === "farmer" ? <DashboardNavbar /> : <Navbar />;
  };

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [emptyMessage, setEmptyMessage] = useState("");
  const [productCache, setProductCache] = useState({});
  const [confirmState, setConfirmState] = useState({
    open: false,
    orderId: null,
    orderItemId: null,
  });
  const [confirmDeliveryState, setConfirmDeliveryState] = useState({
    open: false,
    orderItemId: null,
  });

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilters, setActiveFilters] = useState({
    status: "all", // all, paid, pending, delivered, cancelled
    sortBy: "latest", // latest, oldest, highest_quantity
  });
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);

  const getOrderTime = (o) => {
    const d =
      o?.orderDate ||
      o?.OrderDate ||
      o?.createdAt ||
      o?.CreatedAt ||
      o?.createdOn ||
      o?.CreatedOn ||
      null;
    const t = d ? Date.parse(d) : NaN;
    return Number.isNaN(t) ? 0 : t;
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      setEmptyMessage("");
      const resp = await orderAPI.getMyOrders();
      const payload = resp?.data?.data ?? [];
      const sorted = [...payload].sort(
        (a, b) => getOrderTime(b) - getOrderTime(a)
      );
      setOrders(sorted);

      // Preload all product data for search functionality
      await preloadProductData(sorted);

      // Apply initial filters
      const filtered = applyFiltersAndSearch(sorted, searchTerm, activeFilters);
      setFilteredOrders(filtered);
    } catch (err) {
      if (err?.response?.status === 404) {
        setOrders([]);
        setError(null);
        setEmptyMessage("");
      } else {
        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to load orders. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Preload product data for all orders to enable search functionality
  const preloadProductData = async (ordersList) => {
    const allProductIds = new Set();

    // Collect all unique product IDs from all orders
    ordersList.forEach((order) => {
      const items = Array.isArray(order.orderItems) ? order.orderItems : [];
      items.forEach((item) => {
        const productId = item.productId ?? item.ProductId;
        if (productId && !productCache[productId]) {
          allProductIds.add(productId);
        }
      });
    });

    if (allProductIds.size > 0) {
      setProductsLoading(true);
      try {
        const fetched = await Promise.all(
          Array.from(allProductIds).map(async (productId) => {
            try {
              const r = await productAPI.getProductById(productId);
              const prod = r?.data?.data || r?.data || {};
              return [
                productId,
                {
                  name: prod.productName || prod.name || "Unknown Product",
                  imageCode:
                    prod.productImageCode ||
                    prod.imageCode ||
                    prod.productImageId,
                  rate: prod.rate,
                  unit: prod.unit || "kg",
                  city: prod.city || prod.location || prod.address || null,
                },
              ];
            } catch (error) {
              console.warn(`Failed to fetch product ${productId}:`, error);
              return [
                productId,
                {
                  name: `Product ${productId}`,
                  imageCode: null,
                  rate: 0,
                  unit: "kg",
                  city: null,
                },
              ];
            }
          })
        );

        setProductCache((prev) => {
          const next = { ...prev };
          fetched.forEach(([pid, val]) => {
            if (pid && val && !next[pid]) next[pid] = val;
          });
          return next;
        });
      } catch (error) {
        console.warn("Failed to preload some product data:", error);
      } finally {
        setProductsLoading(false);
      }
    }
  };

  // Filter and sort orders based on search term and filters
  const applyFiltersAndSearch = (ordersList, search, filters) => {
    let filtered = [...ordersList];

    // Apply search filter (search by product name in order items)
    if (search.trim()) {
      filtered = filtered.filter((order) => {
        const items = Array.isArray(order.orderItems) ? order.orderItems : [];
        return items.some((item) => {
          const productId = item.productId ?? item.ProductId;
          const product = productCache[productId];

          // If product is cached, search by name
          if (product?.name) {
            return product.name.toLowerCase().includes(search.toLowerCase());
          }

          // If product not cached but we have a productId, include it in search
          // This handles cases where preload failed but product exists
          if (productId) {
            return String(productId)
              .toLowerCase()
              .includes(search.toLowerCase());
          }

          return false;
        });
      });
    }

    // Apply status filter
    if (filters.status !== "all") {
      filtered = filtered.filter((order) => {
        const items = Array.isArray(order.orderItems) ? order.orderItems : [];

        switch (filters.status) {
          case "paid":
            // Check if any order item has payment status as paid
            return items.some((item) => {
              const paymentStatus = (
                item.paymentStatus ||
                item.PaymentStatus ||
                order.paymentStatus ||
                order.PaymentStatus ||
                ""
              ).toLowerCase();
              return paymentStatus === "paid" || paymentStatus === "completed";
            });

          case "pending":
            // Check order status for pending orders
            const overallStatus = (
              order.overallStatus ||
              order.orderStatus ||
              ""
            ).toLowerCase();
            return ["processing", "confirmed", "pending"].includes(
              overallStatus
            );

          case "delivered":
            // Check if any order item has status as delivered
            return items.some((item) => {
              const itemStatus = (item.itemStatus || "").toLowerCase();
              return itemStatus === "delivered";
            });

          case "cancelled":
            // Check if any order item has status as cancelled
            return items.some((item) => {
              const itemStatus = (item.itemStatus || "").toLowerCase();
              return itemStatus === "cancelled";
            });

          default:
            return true;
        }
      });
    }

    // Apply sorting
    switch (filters.sortBy) {
      case "latest":
        filtered.sort((a, b) => getOrderTime(b) - getOrderTime(a));
        break;
      case "oldest":
        filtered.sort((a, b) => getOrderTime(a) - getOrderTime(b));
        break;
      case "highest_quantity":
        filtered.sort((a, b) => {
          const qtyA = Array.isArray(a.orderItems)
            ? a.orderItems.reduce(
                (sum, item) =>
                  sum + (Number(item.quantity ?? item.Quantity) || 0),
                0
              )
            : 0;
          const qtyB = Array.isArray(b.orderItems)
            ? b.orderItems.reduce(
                (sum, item) =>
                  sum + (Number(item.quantity ?? item.Quantity) || 0),
                0
              )
            : 0;
          return qtyB - qtyA;
        });
        break;
      default:
        break;
    }

    return filtered;
  };

  const handleCancelItem = async (orderId, orderItemId) => {
    try {
      await orderAPI.cancelOrderItem(orderId, orderItemId);
      await fetchOrders(); // Refresh the orders list
      alert("Order item cancelled successfully!");
    } catch (err) {
      console.error("Failed to cancel order item", err);
      alert(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to cancel order item"
      );
    }
  };

  const handleConfirmDelivery = async (orderItemId) => {
    try {
      await orderAPI.markAsDelivery(orderItemId);
      await fetchOrders(); // Refresh the orders list
      alert("Delivery confirmed successfully!");
    } catch (err) {
      console.error("Failed to confirm delivery", err);
      alert(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to confirm delivery"
      );
    }
  };

  const openCancelConfirm = (orderId, orderItemId) => {
    setConfirmState({ open: true, orderId, orderItemId });
  };

  const closeCancelConfirm = () => {
    setConfirmState({ open: false, orderId: null, orderItemId: null });
  };

  const confirmCancel = () => {
    if (confirmState.orderId && confirmState.orderItemId) {
      handleCancelItem(confirmState.orderId, confirmState.orderItemId);
    }
    closeCancelConfirm();
  };

  const openConfirmDelivery = (orderItemId) => {
    setConfirmDeliveryState({ open: true, orderItemId });
  };

  const closeConfirmDelivery = () => {
    setConfirmDeliveryState({ open: false, orderItemId: null });
  };

  const confirmDeliveryAction = () => {
    if (confirmDeliveryState.orderItemId) {
      handleConfirmDelivery(confirmDeliveryState.orderItemId);
    }
    closeConfirmDelivery();
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply filters whenever search term or filters change
  useEffect(() => {
    const filtered = applyFiltersAndSearch(orders, searchTerm, activeFilters);
    setFilteredOrders(filtered);
  }, [orders, searchTerm, activeFilters]);

  const toggleExpand = async (orderId) => {
    setExpanded((p) => ({ ...p, [orderId]: !p[orderId] }));
    try {
      const order = orders.find((o) => o.orderId === orderId);
      if (!order) return;
      const items = Array.isArray(order.orderItems) ? order.orderItems : [];
      const missing = items.filter(
        (it) => it.productId && !productCache[it.productId]
      );
      if (missing.length) {
        const fetched = await Promise.all(
          missing.map(async (it) => {
            try {
              const r = await productAPI.getProductById(it.productId);
              const prod = r?.data?.data || r?.data || {};
              return [
                it.productId,
                {
                  name: prod.productName,
                  imageCode:
                    prod.productImageCode ||
                    prod.imageCode ||
                    prod.productImageId,
                  rate: prod.rate,
                  unit: prod.unit || "kg",
                  city: prod.city || prod.location || prod.address || null,
                },
              ];
            } catch {
              return [it.productId, null];
            }
          })
        );
        setProductCache((prev) => {
          const next = { ...prev };
          fetched.forEach(([pid, val]) => {
            if (pid && val && !next[pid]) next[pid] = val;
          });
          return next;
        });
      }
    } catch {
      // silent
    }
  };

  const formatDateTime = (d) =>
    d
      ? new Date(d).toLocaleString(undefined, {
          year: "numeric",
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "N/A";

  const formatCurrency = (v) => {
    if (v == null) return "—";
    const n = Number(v);
    if (!isFinite(n)) return String(v);
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "NPR",
        currencyDisplay: "symbol",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(n);
    } catch {
      return `Rs ${n}`;
    }
  };

  const statusClass = (s) => {
    const x = (s || "").toLowerCase();

    // Black for Processing
    if (x === "processing") return "pill dark";

    // Blue for Confirmed
    if (x === "confirmed") return "pill info";

    // Orange for Shipped
    if (x === "shipped") return "pill warn";

    // Green for Delivered, Accepted, Completed, Paid
    if (["delivered", "accepted", "completed", "paid"].includes(x))
      return "pill ok";

    // Red for Cancelled, Rejected, Failed, Refunded
    if (["cancelled", "rejected", "failed", "refunded"].includes(x))
      return "pill bad";

    // Default fallback
    return "pill warn";
  };

  if (loading)
    return (
      <div className="orders-page">
        <RoleAwareNavbar />
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading your orders...</p>
        </div>
        <Footer />
      </div>
    );

  if (error)
    return (
      <div className="orders-page">
        <RoleAwareNavbar />
        <div className="error-container">
          <p>{error}</p>
          <button onClick={fetchOrders} className="retry-button">
            Retry
          </button>
        </div>
        <Footer />
      </div>
    );

  return (
    <div className="orders-page">
      <RoleAwareNavbar />
      <div className="orders-container">
        <h1>
          <FaBox /> My Orders
        </h1>

        {/* Search and Filter Controls */}
        <div className="orders-controls">
          <div className="search-container">
            <input
              type="text"
              placeholder={
                productsLoading
                  ? "Loading products..."
                  : "Search by product name..."
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
              disabled={productsLoading}
            />
            {productsLoading && <div className="search-loading">⟳</div>}
          </div>

          <div className="filter-container">
            <select
              value={activeFilters.status}
              onChange={(e) =>
                setActiveFilters((prev) => ({
                  ...prev,
                  status: e.target.value,
                }))
              }
              className="filter-select"
            >
              <option value="all">All Orders</option>
              <option value="paid">Paid Orders</option>
              <option value="pending">Pending Orders</option>
              <option value="delivered">Delivered Orders</option>
              <option value="cancelled">Cancelled Orders</option>
            </select>

            <select
              value={activeFilters.sortBy}
              onChange={(e) =>
                setActiveFilters((prev) => ({
                  ...prev,
                  sortBy: e.target.value,
                }))
              }
              className="filter-select"
            >
              <option value="latest">Latest Orders</option>
              <option value="oldest">Oldest Orders</option>
              <option value="highest_quantity">Highest Quantity</option>
            </select>
          </div>
        </div>

        {/* Results counter */}
        {orders.length > 0 && (
          <div className="results-counter">
            <p>
              {productsLoading ? (
                "Loading product information..."
              ) : (
                <>
                  Showing {filteredOrders.length} of {orders.length} orders
                  {searchTerm && ` matching "${searchTerm}"`}
                </>
              )}
            </p>
          </div>
        )}

        {orders.length === 0 ? (
          <div className="no-orders">
            {emptyMessage ? (
              <p>{emptyMessage}</p>
            ) : (
              <>
                <p>No orders yet</p>
                <p>Once you purchase, your orders will appear here.</p>
              </>
            )}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="no-orders">
            <p>No orders match your search and filter criteria</p>
            <p>Try adjusting your search term or filters.</p>
            <button
              onClick={() => {
                setSearchTerm("");
                setActiveFilters({ status: "all", sortBy: "latest" });
              }}
              className="retry-button"
              style={{ marginTop: "1rem" }}
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="orders-table-wrap">
            <table className="orders-table borderless">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Order Date</th>
                  <th>Updated</th>
                  <th>Total Amount</th>
                  <th>Overall Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o) => {
                  const open = !!expanded[o.orderId];
                  const items = Array.isArray(o.orderItems) ? o.orderItems : [];
                  const backendTotal = Number(o.totalAmount);
                  const fallback = items.reduce((a, it) => {
                    const line =
                      Number(it.totalPrice) ||
                      (Number(it.rate ?? it.Rate) || 0) *
                        (Number(it.quantity ?? it.Quantity) || 0);
                    return a + line;
                  }, 0);
                  const total = isFinite(backendTotal)
                    ? backendTotal
                    : fallback;
                  const overall = o.overallStatus || o.orderStatus;
                  return (
                    <React.Fragment key={o.orderId}>
                      <tr className="order-row">
                        <td className="mono small-id" title={o.orderId}>
                          {o.orderId}
                        </td>
                        <td>{formatDateTime(o.orderDate)}</td>
                        <td>{formatDateTime(o.updatedAt)}</td>
                        <td className="strong">{formatCurrency(total)}</td>
                        <td>
                          <span className={`pill ${statusClass(overall)}`}>
                            {overall || "Pending"}
                          </span>
                        </td>
                        <td>
                          <button
                            className="link-btn"
                            onClick={() => toggleExpand(o.orderId)}
                            aria-expanded={open}
                            aria-controls={`order-${o.orderId}`}
                          >
                            <FaEye style={{ marginRight: 6 }} />
                            {open ? "Hide" : "View"}
                            {open ? (
                              <FaChevronUp style={{ marginLeft: 6 }} />
                            ) : (
                              <FaChevronDown style={{ marginLeft: 6 }} />
                            )}
                          </button>
                        </td>
                      </tr>
                      {open && (
                        <tr
                          id={`order-${o.orderId}`}
                          className="order-details-row"
                        >
                          <td colSpan={6}>
                            <div className="details">
                              <div className="order-items-horizontal">
                                {items.map((it, ix) => {
                                  const productId =
                                    it.productId ?? it.ProductId;
                                  const orderItemId =
                                    it.orderItemId ||
                                    it.OrderItemId ||
                                    `${productId || "unknown"}-${ix}`;
                                  const qty = it.quantity ?? it.Quantity ?? 0;
                                  const rate = it.rate ?? it.Rate ?? 0;
                                  const shipping = 100; // placeholder static
                                  const tax =
                                    0.01 *
                                    (Number(rate) * Number(qty) + shipping);
                                  const paymentStatus =
                                    it.paymentStatus ||
                                    it.PaymentStatus ||
                                    o.paymentStatus ||
                                    o.PaymentStatus ||
                                    null;
                                  const refundStatus =
                                    it.refundStatus || it.RefundStatus || null;
                                  const lineTotal =
                                    Number(it.totalPrice) ||
                                    Number(rate) * Number(qty) + shipping + tax;
                                  const meta = productCache[productId];
                                  const base =
                                    import.meta.env.VITE_API_BASE_URL ||
                                    "https://w1vqqn7ucvzpndp9xsvdkd15gzcedswvilahs3agd6b3dljo7tg24pbklk4u.shamir.com.np";
                                  const imgUrl = meta?.imageCode
                                    ? `${base}/api/Product/getProductImage/${meta.imageCode}`
                                    : null;
                                  const unitLabel =
                                    (
                                      (meta?.unit || "kg") + ""
                                    ).toLowerCase() === "kg"
                                      ? "Kg"
                                      : meta?.unit || "kg";
                                  return (
                                    <div
                                      className="order-item-card two-row"
                                      key={orderItemId}
                                      title={orderItemId}
                                    >
                                      {/* Top Row: Order Item ID */}
                                      <div
                                        className="item-id-row mono"
                                        title={orderItemId}
                                      >
                                        {orderItemId}
                                      </div>
                                      {/* Second Row: Two columns */}
                                      <div className="item-main-row">
                                        <div className="item-left">
                                          <div className="item-image">
                                            {imgUrl ? (
                                              <img
                                                src={imgUrl}
                                                alt={meta?.name || "Product"}
                                                onError={(e) => {
                                                  e.currentTarget.style.display =
                                                    "none";
                                                }}
                                              />
                                            ) : (
                                              <div className="placeholder large">
                                                IMG
                                              </div>
                                            )}
                                          </div>
                                          <div className="item-left-info">
                                            <div className="name">
                                              <strong>
                                                {meta?.name || "—"}
                                              </strong>
                                            </div>
                                            <div className="line">
                                              Qty:{" "}
                                              <span className="qty-val">
                                                {qty}
                                              </span>
                                            </div>
                                            <div className="line rate">
                                              Rate:{" "}
                                              {rate
                                                ? `Rs ${rate}/${unitLabel}`
                                                : meta?.rate
                                                ? `Rs ${meta.rate}/${unitLabel}`
                                                : "—"}
                                            </div>
                                            <div className="line">
                                              Tax: {formatCurrency(tax)}
                                            </div>
                                            <div className="line">
                                              Ship: {formatCurrency(shipping)}
                                            </div>
                                            <div className="line total">
                                              Total:{" "}
                                              <strong>
                                                {formatCurrency(lineTotal)}
                                              </strong>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="item-right">
                                          <div className="right-bottom">
                                            {((
                                              it.itemStatus || ""
                                            ).toLowerCase() === "delivered" ||
                                              (
                                                it.itemStatus || ""
                                              ).toLowerCase() ===
                                                "shipped") && (
                                              <div className="line delivery-action">
                                                <button
                                                  type="button"
                                                  className="item-cancel-btn"
                                                  disabled={
                                                    it.deliveryConfirmedByBuyer ===
                                                    true
                                                  }
                                                  onClick={() =>
                                                    !it.deliveryConfirmedByBuyer &&
                                                    openConfirmDelivery(
                                                      orderItemId
                                                    )
                                                  }
                                                  style={{
                                                    backgroundColor: "#28a745",
                                                    color: "white",
                                                    fontSize: "12px",
                                                    padding: "4px 8px",
                                                    border: "none",
                                                    borderRadius: "4px",
                                                    cursor:
                                                      it.deliveryConfirmedByBuyer ===
                                                      true
                                                        ? "not-allowed"
                                                        : "pointer",
                                                    fontWeight: "500",
                                                    opacity:
                                                      it.deliveryConfirmedByBuyer ===
                                                      true
                                                        ? 0.8
                                                        : 1,
                                                  }}
                                                >
                                                  {it.deliveryConfirmedByBuyer ===
                                                  true
                                                    ? "✓ Delivered Confirmed"
                                                    : "✓ Mark as Delivered"}
                                                </button>
                                              </div>
                                            )}
                                            <div className="line status">
                                              Status:{" "}
                                              <span
                                                className={`pill ${statusClass(
                                                  it.itemStatus
                                                )}`}
                                              >
                                                {it.itemStatus || "—"}
                                              </span>
                                            </div>
                                            {paymentStatus && (
                                              <div className="line pay">
                                                Payment:{" "}
                                                <span
                                                  className={`pill ${statusClass(
                                                    paymentStatus
                                                  )}`}
                                                >
                                                  {paymentStatus}
                                                </span>
                                              </div>
                                            )}
                                            {refundStatus && (
                                              <div className="line refund">
                                                Refund:{" "}
                                                <span
                                                  className={`pill ${statusClass(
                                                    refundStatus
                                                  )}`}
                                                >
                                                  {refundStatus}
                                                </span>
                                              </div>
                                            )}
                                            <div className="line actions">
                                              <button
                                                type="button"
                                                className="item-cancel-btn"
                                                disabled={[
                                                  "Cancelled",
                                                  "Shipped",
                                                  "Delivered",
                                                ].includes(it.itemStatus || "")}
                                                onClick={() =>
                                                  openCancelConfirm(
                                                    o.orderId,
                                                    orderItemId
                                                  )
                                                }
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
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
        )}
      </div>
      {confirmState.open && (
        <div
          className="modal-overlay"
          onClick={closeCancelConfirm}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-content confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Confirm</h2>
              <button
                className="close-btn"
                onClick={closeCancelConfirm}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p>Do you want to Cancel?</p>
              <div className="farmer-actions" style={{ marginTop: 12 }}>
                <button
                  className="reject-btn"
                  type="button"
                  onClick={confirmCancel}
                >
                  Yes
                </button>
                <button
                  className="delete-btn"
                  type="button"
                  onClick={closeCancelConfirm}
                >
                  No
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {confirmDeliveryState.open && (
        <div
          className="modal-overlay"
          onClick={closeConfirmDelivery}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-content confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Confirm Delivery</h2>
              <button
                className="close-btn"
                onClick={closeConfirmDelivery}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p>Confirm that you have received this order item?</p>
              <div className="farmer-actions" style={{ marginTop: 12 }}>
                <button
                  className="reject-btn"
                  type="button"
                  onClick={confirmDeliveryAction}
                >
                  Yes
                </button>
                <button
                  className="delete-btn"
                  type="button"
                  onClick={closeConfirmDelivery}
                >
                  No
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
};

export default MyOrders;
