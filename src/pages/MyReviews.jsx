import React, { useEffect, useState } from "react";
import Footer from "../components/Footer";
import { reviewAPI } from "../api/api";
import { Link, useNavigate, Navigate } from "react-router-dom";
import "../dashBoard/DashBoard.css";
import { useAuth } from "../context/AuthContext";

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://w1vqqn7ucvzpndp9xsvdkd15gzcedswvilahs3agd6b3dljo7tg24pbklk4u.shamir.com.np";

const MyReviews = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviews, setReviews] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const pageTitle = user?.role === "buyer" ? "My Reviews" : "Product Reviews";

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const resp = await reviewAPI.getMyReviews();
        const raw = resp?.data;
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.data)
          ? raw.data
          : Array.isArray(raw?.reviews)
          ? raw.reviews
          : [];
        if (mounted) setReviews(list);
      } catch (e) {
        if (!mounted) return;
        const status = e?.response?.status;
        // Treat 401/403/404/204 as empty (show friendly no-reviews message)
        if (
          status === 401 ||
          status === 403 ||
          status === 404 ||
          status === 204
        ) {
          setReviews([]);
          setError("");
        } else {
          setError(
            e?.response?.data?.message || e.message || "Failed to load reviews"
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Ensure user is authorized before update/delete actions
  const isTokenValid = () => {
    try {
      const token =
        (typeof sessionStorage !== "undefined" &&
          sessionStorage.getItem("authToken")) ||
        localStorage.getItem("authToken");
      const exp =
        (typeof sessionStorage !== "undefined" &&
          sessionStorage.getItem("expiration")) ||
        localStorage.getItem("expiration");
      if (!token || !exp) return false;
      const expTime = Date.parse(exp);
      return !Number.isNaN(expTime) && Date.now() < expTime;
    } catch {
      return false;
    }
  };

  // Admins don't have personal reviews; redirect them to the Admin reviews page
  if (user?.role === "admin") {
    return <Navigate to="/dashboard/admin/reviews" replace />;
  }

  return (
    <div className="dashboard-page full-bleed">
      <div className="dashboard-container">
        <div className="dashboard-flex">
          {/* Sidebar */}
          <aside className="dashboard-sidebar" aria-label="Dashboard sidebar">
            <div className="dashboard-sidebar-content">
              <section className="sidebar-section" style={{ paddingTop: 0 }}>
                <button
                  type="button"
                  className="sidebar-btn"
                  onClick={() => navigate("/dashboard")}
                >
                  Dashboard Home
                </button>
                <button
                  type="button"
                  className="sidebar-btn active"
                  onClick={() => navigate("/dashboard/my-reviews")}
                >
                  {pageTitle}
                </button>
              </section>
            </div>
          </aside>

          {/* Main content */}
          <div className="dashboard-main" style={{ marginTop: "1.25rem" }}>
            <h1 style={{ color: "#2e7d32", marginBottom: "1.25rem" }}>
              {pageTitle}
            </h1>
            {loading && <div>Loading...</div>}
            {error && !loading && (
              <div style={{ color: "#c62828", marginBottom: 12 }}>{error}</div>
            )}
            {!loading && !error && reviews.length === 0 && (
              <div
                style={{
                  color: "#2e5030",
                  background: "#f3f9f3",
                  border: "1px solid #e2efe4",
                  padding: "0.9rem 1rem",
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                {user?.role === "buyer" && (
                  <>
                    <span>You haven’t reviewed any products yet.</span>
                    <button
                      type="button"
                      className="sidebar-btn outline"
                      onClick={() => navigate("/products")}
                    >
                      Explore products
                    </button>
                  </>
                )}
                {user?.role === "farmer" && (
                  <span>No one give review to your products</span>
                )}
                {user?.role === "admin" && (
                  <span>No one add Review to any Product</span>
                )}
              </div>
            )}
            {!loading && !error && reviews.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  marginTop: "0.5rem",
                }}
              >
                {reviews.map((r, idx) => {
                  const text =
                    typeof r === "string"
                      ? r
                      : r.review || r.comment || r.text || "";
                  const productName =
                    r?.productName ||
                    r?.product?.productName ||
                    r?.productTitle ||
                    "Product";
                  const productId =
                    r?.productId ||
                    r?.product?.productId ||
                    r?.product?.id ||
                    r?.idOfProduct;
                  const imageCode =
                    r?.productImageCode ||
                    r?.product?.imageCode ||
                    r?.imageCode;
                  const imgUrl = imageCode
                    ? `${BASE_URL}/api/Product/getProductImage/${imageCode}`
                    : null;
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
                  const reviewKey = r.id || r.reviewId || idx;
                  const isEditing = editId === (r.id || r.reviewId);
                  return (
                    <div
                      key={reviewKey}
                      style={{
                        background: "#fff",
                        border: "1px solid #e0e0e0",
                        borderRadius: 10,
                        padding: "0.9rem 1rem",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "72px 1fr auto",
                          gap: 12,
                          alignItems: "center",
                        }}
                      >
                        <div
                          style={{
                            width: 72,
                            height: 72,
                            borderRadius: 8,
                            overflow: "hidden",
                            background: "#f5f5f5",
                            cursor: productId ? "pointer" : "default",
                          }}
                          onClick={() => {
                            if (productId) navigate(`/products/${productId}`);
                          }}
                        >
                          {imgUrl ? (
                            <img
                              src={imgUrl}
                              alt={productName}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: "100%",
                                height: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#999",
                                fontSize: 12,
                              }}
                            >
                              No Image
                            </div>
                          )}
                        </div>
                        <div>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              alignItems: "baseline",
                              flexWrap: "wrap",
                            }}
                          >
                            <div style={{ fontWeight: 700, color: "#2e7d32" }}>
                              {productId ? (
                                <Link
                                  to={`/products/${productId}`}
                                  style={{
                                    color: "#2e7d32",
                                    textDecoration: "none",
                                  }}
                                >
                                  {productName}
                                </Link>
                              ) : (
                                productName
                              )}
                            </div>
                            {when && (
                              <span style={{ color: "#777", fontSize: 12 }}>
                                • {when}
                              </span>
                            )}
                          </div>
                          {!isEditing ? (
                            <div
                              style={{
                                whiteSpace: "pre-wrap",
                                color: "#333",
                                marginTop: 6,
                              }}
                            >
                              {text}
                            </div>
                          ) : (
                            <div style={{ marginTop: 6 }}>
                              <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                rows={3}
                                style={{ width: "100%", resize: "vertical" }}
                              />
                              <div
                                style={{
                                  display: "flex",
                                  gap: 8,
                                  marginTop: 8,
                                }}
                              >
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={async () => {
                                    if (!isTokenValid()) {
                                      navigate("/login", {
                                        replace: true,
                                        state: {
                                          from: "/dashboard/my-reviews",
                                        },
                                      });
                                      return;
                                    }
                                    const id = r.id || r.reviewId;
                                    if (!id || !editText.trim()) return;
                                    try {
                                      setSaving(true);
                                      const form = new FormData();
                                      form.append(
                                        "newReviewText",
                                        editText.trim()
                                      );
                                      await reviewAPI.updateReview(id, form);
                                      const resp =
                                        await reviewAPI.getMyReviews();
                                      const raw = resp?.data;
                                      const list = Array.isArray(raw)
                                        ? raw
                                        : Array.isArray(raw?.data)
                                        ? raw.data
                                        : Array.isArray(raw?.reviews)
                                        ? raw.reviews
                                        : [];
                                      setReviews(list);
                                      setEditId(null);
                                      setEditText("");
                                    } catch (e) {
                                      alert(
                                        e?.response?.data?.message ||
                                          e.message ||
                                          "Failed to update review"
                                      );
                                    } finally {
                                      setSaving(false);
                                    }
                                  }}
                                >
                                  {saving ? "Saving..." : "Save"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditId(null);
                                    setEditText("");
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                          }}
                        >
                          {!isEditing && (
                            <button
                              type="button"
                              className="sidebar-btn"
                              onClick={() => {
                                setEditId(r.id || r.reviewId);
                                setEditText(text);
                              }}
                            >
                              Update
                            </button>
                          )}
                          <button
                            type="button"
                            className="sidebar-btn danger"
                            disabled={deletingId === (r.id || r.reviewId)}
                            onClick={async () => {
                              if (!isTokenValid()) {
                                navigate("/login", {
                                  replace: true,
                                  state: { from: "/dashboard/my-reviews" },
                                });
                                return;
                              }
                              const id = r.id || r.reviewId;
                              if (!id) return;
                              if (!window.confirm("Delete this review?"))
                                return;
                              try {
                                setDeletingId(id);
                                await reviewAPI.deleteReview(id);
                                setReviews((prev) =>
                                  prev.filter(
                                    (x) => (x.id || x.reviewId) !== id
                                  )
                                );
                              } catch (e) {
                                alert(
                                  e?.response?.data?.message ||
                                    e.message ||
                                    "Failed to delete review"
                                );
                              } finally {
                                setDeletingId(null);
                              }
                            }}
                          >
                            {deletingId === (r.id || r.reviewId)
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default MyReviews;
