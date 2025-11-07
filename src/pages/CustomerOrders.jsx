import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import DashboardNavbar from "../components/DashboardNavbar";
import Footer from "../components/Footer";
import { orderAPI, productAPI, userAPI } from "../api/api";
import { FaBox, FaEye, FaChevronDown, FaChevronUp } from "react-icons/fa";
import "./CustomerOrders.css";

// Farmer view of customer orders, rendered like MyOrders with extra status controls
const CustomerOrders = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({}); // { [orderId]: boolean }
  const [updating, setUpdating] = useState({}); // { [orderId]: boolean }
  const [emptyMessage, setEmptyMessage] = useState("");
  const [buyerNames, setBuyerNames] = useState({}); // { [buyerId]: string }
  const [productCache, setProductCache] = useState({}); // { [productId]: { name, imageCode } }
  const [confirmState, setConfirmState] = useState({
    open: false,
    orderId: null,
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

  // Redirect users who shouldn't see this page
  useEffect(() => {
    if (!user) return;
    if (user.role === "admin") navigate("/admin/orders", { replace: true });
    if (user.role === "buyer") navigate("/my-orders", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (!user || user.role !== "farmer") return;
    fetchOrders();
  }, [user]);

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
      const resp = await orderAPI.getCustomerOrders();
      const payload = resp?.data?.data ?? [];
      const sorted = [...payload].sort(
        (a, b) => getOrderTime(b) - getOrderTime(a)
      );
      setOrders(sorted);

      // Preload all product data for search functionality
      await preloadProductData(sorted);

      // Prefetch buyer names for visible rows
      prefetchBuyerNames(sorted);

      // Apply initial filters
      const filtered = applyFiltersAndSearch(sorted, searchTerm, activeFilters);
      setFilteredOrders(filtered);
    } catch (err) {
      console.error("Error fetching customer orders:", err);
      if (err?.response?.status === 404) {
        setOrders([]);
        setError(null);
        setEmptyMessage(
          "No customer order your product. Share your product to get customer orders."
        );
        return;
      }
      const friendly =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to load orders. Please try again.";
      setError(friendly);
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

  const prefetchBuyerNames = async (ordersList) => {
    try {
      const uniqueIds = Array.from(
        new Set(
          (ordersList || [])
            .map((o) => o.buyerId)
            .filter((id) => id && !buyerNames[id])
        )
      );
      if (uniqueIds.length === 0) return;
      const results = await Promise.all(
        uniqueIds.map(async (id) => {
          try {
            const res = await userAPI.getUserNameById(id);
            const name = res?.data?.data || res?.data || "Buyer";
            return [id, String(name)];
          } catch {
            return [id, "Buyer"];
          }
        })
      );
      setBuyerNames((prev) => {
        const next = { ...prev };
        results.forEach(([id, name]) => {
          if (!next[id]) next[id] = name;
        });
        return next;
      });
    } catch {}
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

  // Apply filters whenever search term or filters change
  useEffect(() => {
    const filtered = applyFiltersAndSearch(orders, searchTerm, activeFilters);
    setFilteredOrders(filtered);
  }, [orders, searchTerm, activeFilters]);

  const toggleExpand = async (orderId) => {
    setExpanded((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
    try {
      const order = orders.find((x) => x.orderId === orderId);
      if (!order) return;
      // Lazy load buyer name
      if (order.buyerId && !buyerNames[order.buyerId]) {
        userAPI
          .getUserNameById(order.buyerId)
          .then((res) => {
            const name = res?.data?.data || res?.data || "Buyer";
            setBuyerNames((p) => ({ ...p, [order.buyerId]: String(name) }));
          })
          .catch(() => {});
      }
      // Lazy load product details for images per item
      const items = Array.isArray(order.orderItems) ? order.orderItems : [];
      const missing = items.filter(
        (it) => it.productId && !productCache[it.productId]
      );
      if (missing.length > 0) {
        const fetched = await Promise.all(
          missing.map(async (it) => {
            try {
              const resp = await productAPI.getProductById(it.productId);
              const prod = resp?.data?.data || resp?.data || {};
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
    } catch {}
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (val) => {
    if (val == null) return "—";
    const num = Number(val);
    if (!isFinite(num)) return String(val);
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "NPR",
        currencyDisplay: "symbol",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(num);
    } catch {
      return `Rs ${num}`;
    }
  };

  const statusClass = (status) => {
    const s = (status || "").toLowerCase();

    // Handle payment statuses with specific colors
    if (s === "paid") return "pill ok"; // Green for Paid
    if (s === "cod") return "pill warn"; // Yellow for COD
    if (s === "pending") return "pill bad"; // Red for Pending

    // Handle order/item statuses with specific colors
    if (s === "processing") return "pill dark"; // Black for Processing
    if (s === "confirmed") return "pill info"; // Blue for Confirmed
    if (s === "shipped") return "pill warn"; // Orange for Shipped
    if (s === "delivered") return "pill ok"; // Green for Delivered

    // Handle other statuses
    if (["accepted", "completed"].includes(s)) return "pill ok";
    if (["rejected", "cancelled", "failed"].includes(s)) return "pill bad"; // Red for Cancelled
    return "pill warn"; // Default fallback
  };

  // Expanded set to give farmers more options; backend will validate
  const allowedStatuses = [
    "pending",
    "accepted",
    "confirmed",
    "processing",
    "packed",
    "shipped",
    "out-for-delivery",
    "delivered",
  ];

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      setUpdating((p) => ({ ...p, [orderId]: true }));
      await orderAPI.updateOrderStatus(orderId, { orderStatus: newStatus });
      await fetchOrders();
    } catch (err) {
      console.error("Failed to update order status", err);
      alert(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to update order status"
      );
    } finally {
      setUpdating((p) => ({ ...p, [orderId]: false }));
    }
  };

  const updateOrderItemStatus = async (orderId, orderItemId, newStatus) => {
    try {
      setUpdating((p) => ({ ...p, [orderId]: true }));

      // Call the appropriate API based on the status
      switch (newStatus.toLowerCase()) {
        case "confirmed":
          await orderAPI.confirmOrderItem(orderItemId);
          break;
        case "shipped":
          await orderAPI.shipOrderItem(orderItemId);
          break;
        case "delivered":
          await orderAPI.deliverOrderItem(orderItemId);
          break;
        default:
          // For processing or other statuses, use the general updateOrderStatus
          await orderAPI.updateOrderStatus(orderId, { orderStatus: newStatus });
          break;
      }

      await fetchOrders(); // Refresh the orders list
      alert(`Order item status updated to ${newStatus} successfully!`);
    } catch (err) {
      console.error("Failed to update order item status", err);
      alert(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to update order item status"
      );
    } finally {
      setUpdating((p) => ({ ...p, [orderId]: false }));
    }
  };

  const handleCancelItem = async (orderId, orderItemId) => {
    try {
      setUpdating((p) => ({ ...p, [orderId]: true }));
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
    } finally {
      setUpdating((p) => ({ ...p, [orderId]: false }));
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

  if (!user || user.role !== "farmer") return null; // redirected already elsewhere

  if (loading) {
    return (
      <div>
        <div className="orders-page">
          <DashboardNavbar />
          <div className="loading-container">
            <div className="loading-spinner" />
            <p>Loading customer orders...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="orders-page">
          <DashboardNavbar />
          <div className="error-container">
            <p>{error}</p>
            <button onClick={fetchOrders} className="retry-button">
              Retry
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div>
      <div className="orders-page">
        <DashboardNavbar />
        <div className="orders-container">
          <div
            style={{
              fontSize: "30px",
              fontWeight: "bold",
              color: "black",
              textAlign: "left",
              marginBottom: "20px",
              marginTop: "50px",
              position: "relative",
            }}
          >
            Customer Orders:
          </div>

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
                  <p>No customer orders yet</p>
                  <p>Orders from your buyers will appear here.</p>
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
                    <th>Buyer Name</th>
                    <th>Overall Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((o) => {
                    const open = !!expanded[o.orderId];
                    const items = Array.isArray(o.orderItems)
                      ? o.orderItems
                      : [];
                    const overall = o.overallStatus || o.orderStatus;
                    return (
                      <React.Fragment key={o.orderId}>
                        <tr className="order-row">
                          <td className="mono small-id" title={o.orderId}>
                            {o.orderId}
                          </td>
                          <td>
                            {formatDateTime(
                              o.orderDate ||
                                o.OrderDate ||
                                o.createdAt ||
                                o.CreatedAt
                            )}
                          </td>
                          <td>{formatDateTime(o.updatedAt)}</td>
                          <td>{buyerNames[o.buyerId] || "—"}</td>
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
                                      it.refundStatus ||
                                      it.RefundStatus ||
                                      null;
                                    const lineTotal =
                                      Number(it.totalPrice) ||
                                      Number(rate) * Number(qty) +
                                        shipping +
                                        tax;
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
                                    const currItemStatus = (
                                      it.itemStatus ||
                                      o.orderStatus ||
                                      o.overallStatus ||
                                      ""
                                    ).toLowerCase();
                                    const isBusy = !!updating[o.orderId];

                                    // Define cascading status options based on current status
                                    const getAllowedStatuses = (
                                      currentStatus
                                    ) => {
                                      const allStatuses = [
                                        "processing",
                                        "confirmed",
                                        "shipped",
                                        "delivered",
                                      ];
                                      const statusHierarchy = {
                                        processing: [
                                          "confirmed",
                                          "shipped",
                                          "delivered",
                                        ],
                                        confirmed: ["shipped", "delivered"],
                                        shipped: ["delivered"],
                                        delivered: [],
                                      };

                                      const allowed =
                                        statusHierarchy[currentStatus] || [];
                                      // Return all statuses - current and allowed next ones
                                      return [currentStatus, ...allowed].filter(
                                        Boolean
                                      );
                                    };

                                    const getAllStatusesForDisplay = () => {
                                      return [
                                        "processing",
                                        "confirmed",
                                        "shipped",
                                        "delivered",
                                      ];
                                    };

                                    const getSelectTextColor = (status) => {
                                      const s = status.toLowerCase();
                                      if (s === "processing") return "#424242"; // Black
                                      if (s === "confirmed") return "#1976d2"; // Blue
                                      if (s === "shipped") return "#f57c00"; // Orange
                                      if (s === "delivered") return "#2e7d32"; // Green
                                      if (s === "cancelled") return "#d32f2f"; // Red
                                      return "#424242"; // Default
                                    };

                                    const getOptionStyle = (
                                      status,
                                      isDisabled = false
                                    ) => {
                                      const s = status.toLowerCase();

                                      // If disabled, return greyed out style
                                      if (isDisabled) {
                                        return {
                                          backgroundColor: "#f5f5f5",
                                          color: "#9e9e9e",
                                          fontWeight: "normal",
                                          cursor: "not-allowed",
                                        };
                                      }

                                      if (s === "processing")
                                        return {
                                          backgroundColor: "#f5f5f5",
                                          color: "#424242",
                                          fontWeight: "bold",
                                        }; // Black
                                      if (s === "confirmed")
                                        return {
                                          backgroundColor: "#e3f2fd",
                                          color: "#1976d2",
                                          fontWeight: "bold",
                                        }; // Blue
                                      if (s === "shipped")
                                        return {
                                          backgroundColor: "#fff3e0",
                                          color: "#f57c00",
                                          fontWeight: "bold",
                                        }; // Orange
                                      if (s === "delivered")
                                        return {
                                          backgroundColor: "#e8f5e9",
                                          color: "#2e7d32",
                                          fontWeight: "bold",
                                        }; // Green
                                      if (s === "cancelled")
                                        return {
                                          backgroundColor: "#ffebee",
                                          color: "#d32f2f",
                                          fontWeight: "bold",
                                        }; // Red
                                      return {
                                        backgroundColor: "#ffffff",
                                        color: "#424242",
                                        fontWeight: "bold",
                                      };
                                    };

                                    const getDisabledStatuses = (
                                      currentStatus
                                    ) => {
                                      const statusOrder = [
                                        "processing",
                                        "confirmed",
                                        "shipped",
                                        "delivered",
                                      ];
                                      const currentIndex =
                                        statusOrder.indexOf(currentStatus);
                                      if (currentIndex === -1) return [];
                                      // Disable all statuses before the current one
                                      return statusOrder.slice(0, currentIndex);
                                    };

                                    const disabledStatuses =
                                      getDisabledStatuses(currItemStatus);
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
                                          style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                          }}
                                        >
                                          <span
                                            style={{
                                              overflow: "hidden",
                                              textOverflow: "ellipsis",
                                              flex: 1,
                                            }}
                                          >
                                            {orderItemId}
                                          </span>
                                          {currItemStatus?.toLowerCase() ===
                                            "delivered" && (
                                            <span
                                              style={{
                                                fontWeight: "bold",
                                                fontSize: "11px",
                                                color:
                                                  it.deliveryConfirmedByBuyer
                                                    ? "#ffffff"
                                                    : "#ffffff",
                                                whiteSpace: "nowrap",
                                                marginLeft: "10px",
                                                padding: "4px 8px",
                                                borderRadius: "6px",
                                                backgroundColor:
                                                  it.deliveryConfirmedByBuyer
                                                    ? "#2e7d32"
                                                    : "#d32f2f",
                                                border: `2px solid ${
                                                  it.deliveryConfirmedByBuyer
                                                    ? "#1b5e20"
                                                    : "#b71c1c"
                                                }`,
                                                boxShadow: `
                                                  0 4px 8px rgba(0, 0, 0, 0.2),
                                                  0 2px 4px rgba(0, 0, 0, 0.1),
                                                  0 0 0 1px ${
                                                    it.deliveryConfirmedByBuyer
                                                      ? "#4caf50"
                                                      : "#f44336"
                                                  } inset,
                                                  0 0 15px ${
                                                    it.deliveryConfirmedByBuyer
                                                      ? "rgba(76, 175, 80, 0.4)"
                                                      : "rgba(244, 67, 54, 0.4)"
                                                  },
                                                  0 0 30px ${
                                                    it.deliveryConfirmedByBuyer
                                                      ? "rgba(76, 175, 80, 0.2)"
                                                      : "rgba(244, 67, 54, 0.2)"
                                                  }
                                                `,
                                                textShadow:
                                                  "0 1px 2px rgba(0, 0, 0, 0.3)",
                                                transition: "all 0.3s ease",
                                                cursor: "default",
                                                position: "relative",
                                                zIndex: 1,
                                              }}
                                            >
                                              {it.deliveryConfirmedByBuyer
                                                ? "✓ Delivery Confirmed"
                                                : "✗ Delivery Not Confirmed"}
                                            </span>
                                          )}
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
                                            {/* Order-level status select at top of right column */}
                                            <div
                                              className="line status-select"
                                              style={{ marginBottom: 12 }}
                                            >
                                              <div
                                                style={{
                                                  fontWeight: "bold",
                                                  color: "black",
                                                  fontSize: "14px",
                                                  marginBottom: "6px",
                                                }}
                                              >
                                                Update Status
                                              </div>
                                              <select
                                                value={currItemStatus}
                                                disabled={
                                                  isBusy ||
                                                  currItemStatus?.toLowerCase() ===
                                                    "cancelled"
                                                }
                                                onChange={(e) =>
                                                  updateOrderItemStatus(
                                                    o.orderId,
                                                    orderItemId,
                                                    e.target.value
                                                  )
                                                }
                                                style={{
                                                  padding: 8,
                                                  borderRadius: 8,
                                                  width: "100%",
                                                  border: "2px solid #2e7d32",
                                                  backgroundColor: "#ffffff",
                                                  color:
                                                    getSelectTextColor(
                                                      currItemStatus
                                                    ),
                                                  fontWeight: "bold",
                                                  cursor: isBusy
                                                    ? "not-allowed"
                                                    : "pointer",
                                                }}
                                                title="Update order status"
                                              >
                                                {[
                                                  "processing",
                                                  "confirmed",
                                                  "shipped",
                                                  "delivered",
                                                  ...(currItemStatus?.toLowerCase() ===
                                                  "cancelled"
                                                    ? ["cancelled"]
                                                    : []),
                                                ].map((s) => {
                                                  const isDisabled =
                                                    disabledStatuses.includes(
                                                      s
                                                    );
                                                  return (
                                                    <option
                                                      key={s}
                                                      value={s}
                                                      disabled={isDisabled}
                                                      style={getOptionStyle(
                                                        s,
                                                        isDisabled
                                                      )}
                                                    >
                                                      {s
                                                        .charAt(0)
                                                        .toUpperCase() +
                                                        s.slice(1)}
                                                    </option>
                                                  );
                                                })}
                                              </select>
                                            </div>
                                            <div className="right-bottom">
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
                                                  disabled={
                                                    currItemStatus?.toLowerCase() ===
                                                      "shipped" ||
                                                    currItemStatus?.toLowerCase() ===
                                                      "delivered" ||
                                                    currItemStatus?.toLowerCase() ===
                                                      "cancelled"
                                                  }
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
      <Footer />
    </div>
  );
};

export default CustomerOrders;
