import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import DashboardNavbar from "../components/DashboardNavbar";
import { useAuth } from "../context/AuthContext";
import Footer from "../components/Footer";
import {
  FaUser,
  FaStar,
  FaRegStar,
  FaCommentDots,
  FaShoppingCart,
  FaShoppingBag,
  FaMapMarkerAlt,
  FaSeedling,
  FaArrowLeft,
  FaPhone,
  FaEnvelope,
  FaShieldAlt,
  FaFileAlt,
  FaChartBar,
  FaTrophy,
  FaMedal,
} from "react-icons/fa";
import { motion } from "framer-motion";
import api, { reviewAPI, userAPI } from "../api/api";
import "./ProductDetails.css";
import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";

const BASE_URL =
  "https://w1vqqn7ucvzpndp9xsvdkd15gzcedswvilahs3agd6b3dljo7tg24pbklk4u.shamir.com.np";

// Role-aware navbar so farmer retains dashboard navigation when viewing details
const RoleAwareNavbar = () => {
  const { user } = useAuth();
  return user?.role === "farmer" ? <DashboardNavbar /> : <Navbar />;
};

const ProductDetails = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [error, setError] = useState(null);
  // Farmer owner panel state
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [ownerError, setOwnerError] = useState("");
  const [farmer, setFarmer] = useState(null);

  // Review form state - single text box as requested
  const [reviewText, setReviewText] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState("");
  // Reviews display state
  const [reviewsExpanded, setReviewsExpanded] = useState(false);
  const [reviewsPage, setReviewsPage] = useState(0); // 0-based index when expanded
  const viewHubRef = useRef(null);

  useEffect(() => {
    fetchProduct();
    fetchReviews();
    // eslint-disable-next-line
  }, [productId]);

  // Reset owner panel on product change
  useEffect(() => {
    setOwnerOpen(false);
    setOwnerError("");
    setOwnerLoading(false);
    setFarmer(null);
  }, [productId]);

  // Join product view (count only) when details page mounts; leave on unmount
  useEffect(() => {
    if (!productId) return;
    let active = true;
    const connection = new HubConnectionBuilder()
      .withUrl(`${BASE_URL}/productViewHub`)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Error)
      .build();
    viewHubRef.current = connection;

    const start = async () => {
      try {
        await connection.start();
        if (active) {
          await connection.invoke("JoinProductView", productId);
        }
      } catch (err) {
        // retry after backoff
        if (active) setTimeout(start, 3000);
      }
    };
    start();

    return () => {
      active = false;
      (async () => {
        try {
          if (viewHubRef.current?.state === "Connected") {
            await viewHubRef.current.invoke("LeaveProductView", productId);
          }
        } catch (_) {}
        try {
          await viewHubRef.current?.stop();
        } catch (_) {}
      })();
    };
  }, [productId]);

  const fetchProduct = async () => {
    try {
      const response = await fetch(
        `${BASE_URL}/api/Product/getProduct/${productId}`
      );
      if (!response.ok) throw new Error("Product not found");
      const data = await response.json();
      console.log("Product data:", data);
      const prod = data.data || data;
      setProduct({
        ...prod,
        imageUrl: prod.imageCode
          ? `${BASE_URL}/api/Product/getProductImage/${prod.imageCode}`
          : null,
      });
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Create initials from a full name
  const getInitials = (name) => {
    if (!name || typeof name !== "string") return "?";
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] || "";
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : "";
    return (first + last).toUpperCase() || first.toUpperCase() || "?";
  };

  // Ensure user is logged in; if not, redirect to login and return false
  const ensureAuthenticated = () => {
    const token =
      (typeof sessionStorage !== "undefined" &&
        sessionStorage.getItem("authToken")) ||
      localStorage.getItem("authToken");
    const exp =
      (typeof sessionStorage !== "undefined" &&
        sessionStorage.getItem("expiration")) ||
      localStorage.getItem("expiration");
    let valid = false;
    if (token && exp) {
      const expTime = Date.parse(exp);
      if (!isNaN(expTime) && Date.now() < expTime) valid = true;
    }
    if (!valid) {
      navigate("/login", {
        replace: true,
        state: { from: `/products/${productId}` },
      });
      return false;
    }
    return true;
  };

  // Fetch farmer details via secured endpoint
  const fetchFarmerDetails = async () => {
    if (!productId) return;
    setOwnerError("");
    setOwnerLoading(true);
    try {
      const resp = await userAPI.getFarmerDetailsByProductId(productId);
      const data = resp?.data ?? resp; // handle normalized {success,data}
      const details = data?.data || data;
      setFarmer(details || null);
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.title ||
        e?.message ||
        "Failed to load farmer details.";
      setOwnerError(msg);
      setFarmer(null);
    } finally {
      setOwnerLoading(false);
    }
  };

  const onViewOwnerClick = async () => {
    if (!ensureAuthenticated()) return;
    // Open panel and fetch if not already loaded
    setOwnerOpen(true);
    if (!farmer) await fetchFarmerDetails();
  };

  const fetchReviews = async () => {
    try {
      if (!productId) return;
      setReviewsLoading(true);
      const resp = await reviewAPI.getProductReviews(productId);
      const raw = resp?.data;
      // Handle both ApiResponse<T> shape and raw array
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
        ? raw.data
        : Array.isArray(raw?.reviews)
        ? raw.reviews
        : [];
      setReviews(list);
      setReviewsLoading(false);
    } catch (err) {
      console.log("Failed to fetch reviews:", err);
      setReviews([]);
      setReviewsLoading(false);
    }
  };

  const handleBuy = () => {
    alert("Proceed to buy!");
  };

  const handleAddToCart = async () => {
    // Auth / token validation
    const token =
      (typeof sessionStorage !== "undefined" &&
        sessionStorage.getItem("authToken")) ||
      localStorage.getItem("authToken");
    const exp =
      (typeof sessionStorage !== "undefined" &&
        sessionStorage.getItem("expiration")) ||
      localStorage.getItem("expiration");
    let valid = false;
    if (token && exp) {
      const expTime = Date.parse(exp);
      if (!isNaN(expTime) && Date.now() < expTime) valid = true;
    }
    if (!valid) {
      navigate("/login", {
        replace: true,
        state: { from: `/products/${productId}` },
      });
      return;
    }
    if (!productId) return;
    try {
      const body = { items: [{ productId, quantity: 1 }] };
      const resp = await api.post("/api/Cart/addToCart", body);
      console.log("Add to cart response", resp.data);
      // Provide simple feedback (replace with toast/snackbar later)
      alert("Added to cart");
    } catch (e) {
      console.error("Add to cart failed", e);
      alert(e.response?.data?.message || e.message || "Failed to add to cart");
    }
  };

  // Handle review form input (single text box)
  const handleReviewChange = (e) => {
    setReviewText(e.target.value);
  };

  // Handle review form submit -> POST /api/Review/AddReview (multipart/form-data)
  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setReviewError("");
    setReviewSuccess("");

    // Basic auth/token validation similar to add-to-cart
    const token =
      (typeof sessionStorage !== "undefined" &&
        sessionStorage.getItem("authToken")) ||
      localStorage.getItem("authToken");
    const exp =
      (typeof sessionStorage !== "undefined" &&
        sessionStorage.getItem("expiration")) ||
      localStorage.getItem("expiration");
    let valid = false;
    if (token && exp) {
      const expTime = Date.parse(exp);
      if (!isNaN(expTime) && Date.now() < expTime) valid = true;
    }
    if (!valid) {
      navigate("/login", {
        replace: true,
        state: { from: `/products/${productId}` },
      });
      return;
    }

    if (!productId) {
      setReviewError("Invalid product.");
      return;
    }
    if (!reviewText || !reviewText.trim()) {
      setReviewError("Please write a review before submitting.");
      return;
    }

    try {
      setReviewSubmitting(true);
      const formData = new FormData();
      formData.append("productId", productId);
      formData.append("review", reviewText.trim());

      await reviewAPI.addReview(formData);
      setReviewSuccess("Thanks! Your review has been submitted.");
      setReviewText("");
      // Refresh reviews list if/when endpoint is available
      fetchReviews();
      setTimeout(() => setReviewSuccess(""), 3000);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.title ||
        err?.message ||
        "Failed to submit review.";
      setReviewError(msg);
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div>
        <RoleAwareNavbar />
        <div style={{ textAlign: "center", margin: "2rem" }}>Loading...</div>
        <Footer />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div>
        <RoleAwareNavbar />
        <div style={{ textAlign: "center", margin: "2rem" }}>
          {error || "Product not found."}
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div>
      <RoleAwareNavbar />

      <motion.div
        className="product-details-container"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        <motion.button
          className="back-to-marketplace-btn"
          onClick={() => navigate("/marketplace")}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <FaArrowLeft />
          Back to Marketplace
        </motion.button>
        <div className="product-details-main">
          <motion.img
            src={product.imageUrl || require("../assets/Images/no-image.png")}
            alt={product.productName}
            className="product-details-image"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            onError={(e) => {
              console.log("Image failed to load:", e.target.src);
              e.target.onerror = null;
              e.target.src = require("../assets/Images/no-image.png");
            }}
          />
          <div className="product-details-info">
            <h1>
              <FaSeedling
                style={{
                  color: "#388e3c",
                  marginRight: "0.5rem",
                  verticalAlign: "middle",
                }}
              />
              {product.productName}
            </h1>
            <p className="product-details-price">
              <FaShoppingBag
                style={{
                  color: "#ff9800",
                  marginRight: "0.4rem",
                  verticalAlign: "middle",
                }}
              />
              Rs. {product.rate} per kg
            </p>
            <p>
              <strong>Available:</strong> {product.availableQuantity} kg
            </p>
            <p>
              <FaMapMarkerAlt
                style={{
                  color: "#388e3c",
                  marginRight: "0.3rem",
                  verticalAlign: "middle",
                }}
              />
              <strong>Location:</strong> {product.city}
            </p>
            <p>
              <FaUser
                style={{
                  color: "#388e3c",
                  marginRight: "0.3rem",
                  verticalAlign: "middle",
                }}
              />
              <strong>Farmer:</strong> {product.farmerName}
              {product.farmerPhoneNumber}
            </p>
            <div className="product-details-buttons">
              <motion.button
                className="buy-btn"
                onClick={handleBuy}
                whileHover={{ scale: 1.07 }}
                whileTap={{ scale: 0.96 }}
              >
                <FaShoppingBag
                  style={{ marginRight: "0.4rem", verticalAlign: "middle" }}
                />
                Buy
              </motion.button>
              <motion.button
                className="cart-btn"
                onClick={handleAddToCart}
                whileHover={{ scale: 1.07 }}
                whileTap={{ scale: 0.96 }}
              >
                <FaShoppingCart
                  style={{ marginRight: "0.4rem", verticalAlign: "middle" }}
                />
                Add to Cart
              </motion.button>
              <motion.button
                className="owner-btn"
                onClick={onViewOwnerClick}
                whileHover={{ scale: 1.07 }}
                whileTap={{ scale: 0.96 }}
                title="View Product owner"
              >
                View Product owner
              </motion.button>
            </div>
          </div>
        </div>
        <div className="product-details-description">
          <h2>Description</h2>
          <p>{product.description || "No description available."}</p>
        </div>
        <div className="product-details-reviews">
          <h2>
            <FaCommentDots
              style={{
                color: "#388e3c",
                marginRight: "0.5rem",
                verticalAlign: "middle",
              }}
            />
            Reviews
          </h2>
          <div className="reviews-list">
            {reviewsLoading ? (
              <p>Loading reviews...</p>
            ) : reviews.length === 0 ? (
              <p className="no-reviews">
                No reviews yet. Be the first to review.
              </p>
            ) : (
              (() => {
                const PAGE_SIZE = 10;
                const visible = reviewsExpanded
                  ? reviews.slice(
                      reviewsPage * PAGE_SIZE,
                      reviewsPage * PAGE_SIZE + PAGE_SIZE
                    )
                  : reviews.slice(0, 2);
                const totalPages = Math.ceil(reviews.length / PAGE_SIZE);
                return (
                  <>
                    {visible.map((r, idx) => {
                      const text =
                        typeof r === "string"
                          ? r
                          : r.review || r.comment || r.text || "";
                      const author =
                        r?.userName ||
                        r?.fullName ||
                        r?.createdByName ||
                        r?.user?.fullName ||
                        r?.user?.name ||
                        "Anonymous";
                      const ts =
                        r?.createdAt ||
                        r?.createdOn ||
                        r?.createdDate ||
                        r?.timestamp ||
                        r?.date;
                      let when = "";
                      try {
                        if (ts) when = new Date(ts).toLocaleString();
                      } catch {}
                      return (
                        <div key={r.id || idx} className="review-item">
                          <div className="review-header">
                            <FaUser
                              style={{ marginRight: 6, color: "#388e3c" }}
                            />
                            <strong>{author}</strong>
                            {when ? (
                              <span className="review-meta"> • {when}</span>
                            ) : null}
                          </div>
                          <div className="review-text">{text}</div>
                        </div>
                      );
                    })}
                    {!reviewsExpanded && reviews.length > 2 && (
                      <div className="reviews-controls">
                        <button
                          type="button"
                          className="reviews-expand-btn"
                          onClick={() => {
                            setReviewsExpanded(true);
                            setReviewsPage(0);
                          }}
                        >
                          Show more reviews
                        </button>
                      </div>
                    )}
                    {reviewsExpanded && reviews.length > PAGE_SIZE && (
                      <div className="reviews-pagination">
                        <button
                          type="button"
                          onClick={() =>
                            setReviewsPage((p) => Math.max(0, p - 1))
                          }
                          disabled={reviewsPage === 0}
                        >
                          Previous
                        </button>
                        <span className="reviews-page-indicator">
                          Page {reviewsPage + 1} of {totalPages}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setReviewsPage((p) =>
                              (p + 1) * PAGE_SIZE >= reviews.length ? p : p + 1
                            )
                          }
                          disabled={
                            (reviewsPage + 1) * PAGE_SIZE >= reviews.length
                          }
                        >
                          Next
                        </button>
                      </div>
                    )}
                    {reviewsExpanded && reviews.length > 2 && (
                      <div className="reviews-controls">
                        <button
                          type="button"
                          className="reviews-compact-btn"
                          onClick={() => {
                            setReviewsExpanded(false);
                            setReviewsPage(0);
                          }}
                        >
                          Show less reviews
                        </button>
                      </div>
                    )}
                  </>
                );
              })()
            )}
          </div>

          {/* Review Form - single text box */}
          <div className="review-form-section">
            <h3>
              <FaCommentDots
                style={{
                  color: "#388e3c",
                  marginRight: "0.4rem",
                  verticalAlign: "middle",
                }}
              />
              Add a Review
            </h3>
            {reviewError && (
              <div className="review-error-message">{reviewError}</div>
            )}
            {reviewSuccess && (
              <div className="review-success-message">{reviewSuccess}</div>
            )}
            <form onSubmit={handleReviewSubmit} className="review-form">
              <textarea
                name="review"
                placeholder="Write your review here..."
                value={reviewText}
                onChange={handleReviewChange}
                required
                rows={3}
              />
              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={reviewSubmitting}
              >
                {reviewSubmitting ? "Submitting..." : "Submit Review"}
              </motion.button>
            </form>
          </div>
        </div>
      </motion.div>
      {/* Right-side farmer details panel */}
      <div className={`owner-panel ${ownerOpen ? "open" : ""}`}>
        <div className="owner-header">
          <div className="owner-title">Product Owner</div>
          <button
            className="owner-close"
            onClick={() => setOwnerOpen(false)}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="owner-body">
          {ownerLoading ? (
            <div className="owner-loading">Loading owner details...</div>
          ) : ownerError ? (
            <div className="owner-error">{ownerError}</div>
          ) : !farmer ? (
            <div className="owner-empty">No details available.</div>
          ) : (
            <>
              {/* Profile Section */}
              <div className="owner-section">
                <div className="owner-profile">
                  <div className="owner-avatar" aria-label={farmer.fullName}>
                    {getInitials(farmer.fullName)}
                  </div>
                  <div className="owner-name-email">
                    <div className="owner-name">
                      {farmer.fullName || "Unknown Farmer"}
                    </div>
                    <div className="owner-email">
                      <FaEnvelope
                        style={{ marginRight: "0.3rem", color: "#607d8b" }}
                      />
                      {farmer.email || "No email provided"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Info Section */}
              <div className="owner-section">
                <h4 className="section-title">
                  <FaPhone
                    style={{ marginRight: "0.5rem", color: "#388e3c" }}
                  />
                  Contact Information
                </h4>
                <div className="owner-contact">
                  <div className="contact-item">
                    <FaPhone
                      style={{ color: "#388e3c", marginRight: "0.5rem" }}
                    />
                    <span>{farmer.phoneNumber || "Not provided"}</span>
                  </div>
                  <div className="contact-item">
                    <FaMapMarkerAlt
                      style={{ color: "#388e3c", marginRight: "0.5rem" }}
                    />
                    <span>
                      {[farmer.address, farmer.city, farmer.country]
                        .filter(Boolean)
                        .join(", ") || "Location not specified"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Reputation & Report Section */}
              <div className="owner-section">
                <h4 className="section-title">
                  <FaShieldAlt
                    style={{ marginRight: "0.5rem", color: "#388e3c" }}
                  />
                  Trust & Reputation
                </h4>
                <div className="owner-reputation">
                  <div className="rep-item">
                    <FaShieldAlt
                      style={{ color: "#ff9800", marginRight: "0.5rem" }}
                    />
                    <div>
                      <strong>Reputation:</strong>{" "}
                      {farmer.reputation || "Not rated"}
                    </div>
                  </div>
                  <div className="rep-item">
                    <FaFileAlt
                      style={{ color: "#2196f3", marginRight: "0.5rem" }}
                    />
                    <div>
                      <strong>Report:</strong>{" "}
                      {farmer.report || "No report available"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sales Stats Section */}
              <div className="owner-section">
                <h4 className="section-title">
                  <FaChartBar
                    style={{ marginRight: "0.5rem", color: "#388e3c" }}
                  />
                  Sales Performance
                </h4>
                <div className="owner-stats">
                  <div className="stat">
                    <div className="stat-value">
                      {farmer.totalProducts ?? 0}
                    </div>
                    <div className="stat-label">Products Listed</div>
                  </div>
                  <div className="stat">
                    <div className="stat-value">
                      {farmer.totalProductSolded ?? 0}
                    </div>
                    <div className="stat-label">Total Sold</div>
                  </div>
                  <div className="stat">
                    <div className="stat-value">
                      {Number(farmer.averageSoldedQuantity || 0).toFixed(1)}
                    </div>
                    <div className="stat-label">Avg Qty Sold</div>
                  </div>
                </div>
              </div>

              {/* Top Products Section */}
              <div className="owner-section">
                <h4 className="section-title">
                  <FaTrophy
                    style={{ marginRight: "0.5rem", color: "#388e3c" }}
                  />
                  Product Highlights
                </h4>
                <div className="owner-minmax">
                  <div className="minmax-item">
                    <FaTrophy
                      style={{ color: "#ff9800", marginRight: "0.5rem" }}
                    />
                    <div>
                      <div className="minmax-label">Best-selling Product</div>
                      <div className="minmax-value">
                        {farmer.maxSoldedProduct?.productName || "None"}
                        {farmer.maxSoldedProduct?.soldedQuantity != null
                          ? ` (${farmer.maxSoldedProduct.soldedQuantity} sold)`
                          : ""}
                      </div>
                    </div>
                  </div>
                  <div className="minmax-item">
                    <FaMedal
                      style={{ color: "#9e9e9e", marginRight: "0.5rem" }}
                    />
                    <div>
                      <div className="minmax-label">Least-selling Product</div>
                      <div className="minmax-value">
                        {farmer.minSoldedProduct?.productName || "None"}
                        {farmer.minSoldedProduct?.soldedQuantity != null
                          ? ` (${farmer.minSoldedProduct.soldedQuantity} sold)`
                          : ""}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      {ownerOpen && (
        <div className="owner-scrim" onClick={() => setOwnerOpen(false)} />
      )}
      <Footer />
    </div>
  );
};

export default ProductDetails;
