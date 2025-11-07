import React, { useEffect, useMemo, useState } from "react";
import { reviewAPI } from "../../api/api";
import { extractApiErrorMessage } from "../../api/handleApiResponse";
import "./AdminReviews.css";

function toDateStr(v) {
  if (!v) return "-";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString();
  } catch {
    return String(v);
  }
}

const AdminReviews = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reviews, setReviews] = useState([]);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState(() => ({}));
  const [reporting, setReporting] = useState(() => ({}));
  const [expanded, setExpanded] = useState(() => ({}));

  const BASE_URL =
    import.meta.env.VITE_API_BASE_URL ||
    "https://w1vqqn7ucvzpndp9xsvdkd15gzcedswvilahs3agd6b3dljo7tg24pbklk4u.shamir.com.np";

  const fetchReviews = async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await reviewAPI.getAllReviews();
      if (resp.success) {
        const list = Array.isArray(resp.data) ? resp.data : [];
        setReviews(list);
      } else {
        setError(resp.error || resp.message || "Failed to load reviews");
      }
    } catch (err) {
      setError(extractApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reviews;
    return reviews.filter((r) => {
      const hay = [
        r?.productName,
        r?.farmerName,
        r?.userName,
        r?.review,
        r?.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [reviews, search]);

  const handleDelete = async (id) => {
    if (!id) return;
    if (!window.confirm("Delete this review?")) return;
    setDeleting((m) => ({ ...m, [id]: true }));
    try {
      const resp = await reviewAPI.deleteReview(id);
      // Some backends may not wrap delete responses; treat non-2xx as throw
      if (resp?.success === false) {
        alert(resp.error || resp.message || "Failed to delete review");
      }
      setReviews((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      alert(extractApiErrorMessage(err));
    } finally {
      setDeleting((m) => ({ ...m, [id]: false }));
    }
  };

  const handleIncreaseReport = async (id) => {
    if (!id) return;
    const ok = window.confirm("Increase report count for this review?");
    if (!ok) return;
    setReporting((m) => ({ ...m, [id]: true }));
    try {
      // TODO: Wire API when provided by backend
      // await reviewAPI.increaseReportCount(id)
      await new Promise((r) => setTimeout(r, 400));
      alert("Report count increased (temporary – API pending)");
    } catch (err) {
      alert(extractApiErrorMessage(err));
    } finally {
      setReporting((m) => ({ ...m, [id]: false }));
    }
  };

  const toggleExpanded = (id) => setExpanded((m) => ({ ...m, [id]: !m[id] }));

  return (
    <div className="admin-page-layout">
      <main className="admin-main-content">
        <div className="admin-reviews-header">
          <div>
            <h1 className="admin-reviews-title">Product Reviews</h1>
            <p className="admin-reviews-subtitle">
              View all product reviews across the platform. Search, inspect, and
              delete if needed.
            </p>
          </div>
          <div className="admin-reviews-actions">
            <button className="btn" onClick={fetchReviews} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="admin-reviews-toolbar">
          <input
            className="input"
            placeholder="Search product, farmer, reviewer, text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {error && <div className="error-box">{error}</div>}
        {loading && reviews.length === 0 && !error && (
          <div className="table-wrap" style={{ padding: 16 }}>
            Loading reviews...
          </div>
        )}

        <div className="table-wrap">
          <table className="reviews-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Farmer</th>
                <th>Reviewer</th>
                <th>Review</th>
                <th>When</th>
                <th>Description</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 24 }}>
                    No reviews to show
                  </td>
                </tr>
              )}
              {filtered.map((r) => {
                const imgUrl = r?.imageCode
                  ? `${BASE_URL}/api/Product/getProductImage/${r.imageCode}`
                  : null;
                const isOpen = !!expanded[r.id];
                return (
                  <>
                    <tr key={r.id} className={isOpen ? "row-open" : ""}>
                      <td>
                        <div className="prod-cell">
                          <button
                            type="button"
                            className={`chev-btn ${isOpen ? "open" : ""}`}
                            aria-label={isOpen ? "Collapse" : "Expand"}
                            onClick={() => toggleExpanded(r.id)}
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                            >
                              <path
                                d="M6 9l6 6 6-6"
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                          <div className="thumb-wrap">
                            {imgUrl ? (
                              <img
                                className="thumb"
                                src={imgUrl}
                                alt={r.productName || "Product"}
                              />
                            ) : (
                              <div className="thumb thumb-empty">No Img</div>
                            )}
                          </div>
                          <div className="prod-meta">
                            <div className="cell-main">
                              {r.productName || "-"}
                            </div>
                            <div
                              className="cell-sub mono small"
                              title={r.productId}
                            >
                              {r.productId}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="nowrap">{r.farmerName || "-"}</td>
                      <td className="nowrap">{r.userName || "-"}</td>
                      <td style={{ maxWidth: 360 }}>
                        <div className="clamp-3" title={r.review}>
                          {r.review}
                        </div>
                      </td>
                      <td>{toDateStr(r.timeStamp)}</td>
                      <td style={{ maxWidth: 260 }}>
                        <div className="clamp-2" title={r.description}>
                          {r.description}
                        </div>
                      </td>
                      <td className="actions-td">
                        <div className="actions-cell">
                          <button
                            className="btn btn-warning"
                            disabled={!!reporting[r.id]}
                            onClick={() => handleIncreaseReport(r.id)}
                          >
                            {reporting[r.id] ? "Increasing..." : "Report ++"}
                          </button>
                          <button
                            className="btn btn-danger"
                            disabled={!!deleting[r.id]}
                            onClick={() => handleDelete(r.id)}
                          >
                            {deleting[r.id] ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="details-row">
                        <td colSpan={7}>
                          <div className="details-wrap">
                            <div className="details-grid">
                              <div>
                                <div className="dt">Review ID</div>
                                <div className="dd mono small" title={r.id}>
                                  {r.id}
                                </div>
                              </div>
                              <div>
                                <div className="dt">Product ID</div>
                                <div
                                  className="dd mono small"
                                  title={r.productId}
                                >
                                  {r.productId}
                                </div>
                              </div>
                              <div>
                                <div className="dt">User ID</div>
                                <div className="dd mono small" title={r.userId}>
                                  {r.userId}
                                </div>
                              </div>
                              <div>
                                <div className="dt">Farmer</div>
                                <div className="dd">{r.farmerName || "-"}</div>
                              </div>
                              <div>
                                <div className="dt">Reviewer</div>
                                <div className="dd">{r.userName || "-"}</div>
                              </div>
                              <div>
                                <div className="dt">Timestamp</div>
                                <div className="dd">
                                  {toDateStr(r.timeStamp)}
                                </div>
                              </div>
                            </div>
                            {r.description && (
                              <div className="desc-full">
                                <div className="dt">Description</div>
                                <div className="dd">{r.description}</div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};

export default AdminReviews;
