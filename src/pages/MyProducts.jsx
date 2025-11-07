import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Footer from "../components/Footer";
import "./MyProducts.css";
import { productAPI } from "../api/api";
import noImage from "../assets/Images/no-image.png";
import LocationPicker from "../components/LocationPicker";
import "../components/BulkOrderModal.css";

const BASE_URL =
  "https://w1vqqn7ucvzpndp9xsvdkd15gzcedswvilahs3agd6b3dljo7tg24pbklk4u.shamir.com.np";
const CATEGORY_OPTIONS = [
  "Vegetables",
  "Fruits",
  "Grains",
  "Dairy",
  "Livestock",
  "Seeds",
  "Spices & Herbs",
  "Flowers & Plants",
  "Pulses & Legumes",
  "Nuts",
  "Beverages",
  "Fish & Seafood",
  "Eggs & Poultry",
  "Honey & Bee Products",
  "Organic Products",
  "Tools",
  "Other",
];

const ProductImage = ({ product }) => {
  const handleImageError = (e) => {
    e.target.src = noImage;
  };
  return (
    <div className="product-image">
      <img
        src={product.imageUrl || noImage}
        alt={product.productName || "Product"}
        onError={handleImageError}
        loading="lazy"
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
};

const MyProducts = () => {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editFormData, setEditFormData] = useState({
    productName: "",
    rate: "",
    availableQuantity: "",
    category: "",
    unit: "",
    location: "",
    description: "",
    image: null,
  });
  const [editLocation, setEditLocation] = useState({
    latitude: "",
    longitude: "",
    address: "",
  });
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editError, setEditError] = useState("");
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  // Client-side incremental reveal (no backend pagination exposed)
  const INITIAL_VISIBLE = 12; // reveal first 3 rows (4-col grid)
  const INCREMENT = 12; // add 3 rows per step
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const sentinelRef = useRef(null);
  const ioRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const statChipStyle = {
    background: "#f0f8f1",
    color: "#1f3321",
    padding: "0.4rem 0.75rem",
    borderRadius: "999px",
    fontSize: "0.65rem",
    fontWeight: 600,
    letterSpacing: "0.5px",
    border: "1px solid #d4e7d6",
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Observe sentinel to reveal more items
  useEffect(() => {
    const node = sentinelRef.current;
    const filteredLength = products.filter((p) => {
      if (!searchTerm.trim()) return true;
      const t = searchTerm.toLowerCase();
      return (
        (p.productName || "").toLowerCase().includes(t) ||
        (p.category || "").toLowerCase().includes(t) ||
        (p.city || "").toLowerCase().includes(t)
      );
    }).length;
    if (!node) return;
    if (visibleCount >= filteredLength) return;
    ioRef.current?.disconnect?.();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisibleCount((v) => Math.min(v + INCREMENT, filteredLength));
          }
        }
      },
      { root: null, rootMargin: "0px 0px 400px 0px", threshold: 0 }
    );
    observer.observe(node);
    ioRef.current = observer;
    return () => observer.disconnect();
  }, [products, searchTerm, visibleCount]);

  // Fallback scroll/resize listener
  useEffect(() => {
    const filteredLength = products.filter((p) => {
      if (!searchTerm.trim()) return true;
      const t = searchTerm.toLowerCase();
      return (
        (p.productName || "").toLowerCase().includes(t) ||
        (p.category || "").toLowerCase().includes(t) ||
        (p.city || "").toLowerCase().includes(t)
      );
    }).length;
    const check = () => {
      if (visibleCount >= filteredLength) return;
      const node = sentinelRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      if (rect.top <= vh + 120) {
        setVisibleCount((v) => Math.min(v + INCREMENT, filteredLength));
      }
    };
    const opts = { passive: true };
    window.addEventListener("scroll", check, opts);
    window.addEventListener("resize", check, opts);
    setTimeout(check, 0);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [products, searchTerm, visibleCount]);

  // Reset visible window when search term changes
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
  }, [searchTerm]);

  const fetchProducts = async () => {
    try {
      const resp = await productAPI.getMyProducts();
      if (!resp.success)
        throw new Error(resp.error || "Failed to fetch products");
      const list = Array.isArray(resp.data)
        ? resp.data.map((p) => ({
            ...p,
            productId: p.productId || p.id,
            imageUrl: p.imageCode
              ? `${BASE_URL}/api/Product/getProductImage/${p.imageCode}`
              : null,
          }))
        : [];
      setProducts(list);
      setVisibleCount(INITIAL_VISIBLE);
    } catch (err) {
      console.error("Error fetching products", err);
      setError(err.message);
      if (
        err.message.includes("Unauthorized") ||
        err.message.includes("No authentication token")
      ) {
        localStorage.removeItem("authToken");
        localStorage.removeItem("user");
        navigate("/login");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (e, product) => {
    e.stopPropagation();
    setSelectedProduct(product);
    setEditFormData({
      productName: product.productName || "",
      rate: product.rate || "",
      availableQuantity: product.availableQuantity || "",
      category: product.category || "",
      unit: product.unit || "",
      location: product.location || product.address || "",
      description: product.description || "",
      image: null,
    });
    setEditLocation({
      latitude: product.latitude ? String(product.latitude) : "",
      longitude: product.longitude ? String(product.longitude) : "",
      address: product.address || product.location || "",
    });
    setIsEditing(true);
  };
  const handleInputChange = (e) => {
    const { name, value, files, type } = e.target;
    setEditFormData((prev) => ({
      ...prev,
      [name]: type === "file" ? files[0] : value,
    }));
  };
  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    setEditError("");
    try {
      const fd = new FormData();
      const appendIf = (k, v) => {
        if (v !== undefined && v !== null && String(v).trim() !== "")
          fd.append(k, v);
      };
      appendIf("ProductName", editFormData.productName);
      appendIf("Rate", editFormData.rate);
      appendIf("AvailableQuantity", editFormData.availableQuantity);
      appendIf("Category", editFormData.category);
      appendIf("Unit", editFormData.unit);
      const lat = editLocation.latitude || selectedProduct?.latitude;
      const lng = editLocation.longitude || selectedProduct?.longitude;
      if (!lat || !lng) {
        setEditError("Please select location (latitude & longitude).");
        return;
      }
      fd.append("Latitude", lat);
      fd.append("Longitude", lng);
      appendIf("Location", editFormData.location);
      appendIf("Description", editFormData.description);
      if (editFormData.image) fd.append("Image", editFormData.image);
      await productAPI.updateProduct(selectedProduct.productId, fd);
      setIsEditing(false);
      fetchProducts();
    } catch (err) {
      console.error("Update failed", err);
      setEditError(
        err.response?.data?.message || err.message || "Failed to update product"
      );
    }
  };
  const handleDeleteClick = async (e, productId) => {
    e.stopPropagation();
    setIsDeleting(true);
    try {
      await productAPI.deleteProduct(productId);
      fetchProducts();
    } catch (err) {
      setError("Failed to delete product");
    } finally {
      setIsDeleting(false);
    }
  };
  const handleToggleStatus = async (e, product) => {
    e.stopPropagation();
    if (statusUpdatingId) return;
    setStatusUpdatingId(product.productId);
    try {
      await productAPI.updateProductStatus(product.productId);
      setProducts((prev) =>
        prev.map((p) =>
          p.productId === product.productId
            ? { ...p, isActive: !p.isActive }
            : p
        )
      );
    } catch (err) {
      console.error("Status update failed", err);
    } finally {
      setStatusUpdatingId(null);
    }
  };

  if (loading) return <div className="loading-container">Loading...</div>;
  if (error && error.toLowerCase().includes("not found"))
    return (
      <div className="my-products-page">
        {/* Navbar is rendered by DashboardLayout */}
        <div className="my-products-container">
          <header
            className="farmer-products-header"
            style={{ textAlign: "center", marginBottom: "1.75rem" }}
          >
            <h1
              style={{
                margin: "0 0 .4rem",
                fontSize: "2rem",
                color: "#2e7d32",
              }}
            >
              Manage Your Produce
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: "0.9rem",
                color: "#46624a",
                maxWidth: 640,
                marginInline: "auto",
                lineHeight: 1.4,
              }}
            >
              Keep your listings fresh: update quantities after each sale,
              toggle availability when stock is low, and add clear photos to
              attract buyers. Accurate location & unit pricing helps you sell
              faster.
            </p>
            <div className="my-products-tools" style={{ marginTop: "1rem" }}>
              <input
                type="text"
                className="my-products-search"
                placeholder="Search by name, category, city..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="my-products-stats" aria-label="product stats">
                <span className="stat-chip">Total: 0</span>
                <span className="stat-chip">Active: 0</span>
                <span className="stat-chip">Inactive: 0</span>
              </div>
            </div>
          </header>
          <div className="product-list-view">
            <div className="no-products-message">
              <h2>No products found.</h2>
              <p>
                Please{" "}
                <Link to="/add-product" className="add-product-link">
                  add your first product!
                </Link>
              </p>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  if (error) return <div className="error-container">Error: {error}</div>;

  return (
    <div className="my-products-page">
      {/* Navbar is rendered by DashboardLayout */}
      <div className="my-products-container">
        <header
          className="farmer-products-header"
          style={{ textAlign: "center", marginBottom: "1.75rem" }}
        >
          <h1
            style={{ margin: "0 0 .4rem", fontSize: "2rem", color: "#2e7d32" }}
          >
            Manage Your Produce
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: "0.9rem",
              color: "#46624a",
              maxWidth: 640,
              marginInline: "auto",
              lineHeight: 1.4,
            }}
          >
            Keep your listings fresh: update quantities after each sale, toggle
            availability when stock is low, and add clear photos to attract
            buyers. Accurate location & unit pricing helps you sell faster.
          </p>
          <div
            className="my-products-tools"
            style={{
              marginTop: "1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.65rem",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.65rem",
                justifyContent: "center",
              }}
            >
              <input
                type="text"
                className="my-products-search"
                placeholder="Search by name, category, city..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  flex: "1 1 280px",
                  maxWidth: 420,
                  padding: "0.7rem 0.9rem",
                  border: "1.5px solid #c8dcc9",
                  borderRadius: 10,
                  fontSize: "0.85rem",
                }}
              />
            </div>
            <div
              className="my-products-stats"
              aria-label="product stats"
              style={{
                display: "flex",
                gap: "0.6rem",
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              {(() => {
                const total = products.length;
                const active = products.filter((p) => p.isActive).length;
                const inactive = total - active;
                return [
                  <span key="t" className="stat-chip" style={statChipStyle}>
                    Total: {total}
                  </span>,
                  <span key="a" className="stat-chip" style={statChipStyle}>
                    Active: {active}
                  </span>,
                  <span key="i" className="stat-chip" style={statChipStyle}>
                    Inactive: {inactive}
                  </span>,
                ];
              })()}
            </div>
          </div>
        </header>
        <div className="product-list-view">
          {products.length === 0 ? (
            <div className="no-products-message">
              <h2>No products found.</h2>
              <p>
                Please{" "}
                <Link to="/add-product" className="add-product-link">
                  add your first product!
                </Link>
              </p>
            </div>
          ) : (
            products
              .filter((p) => {
                if (!searchTerm.trim()) return true;
                const t = searchTerm.toLowerCase();
                return (
                  (p.productName || "").toLowerCase().includes(t) ||
                  (p.category || "").toLowerCase().includes(t) ||
                  (p.city || "").toLowerCase().includes(t)
                );
              })
              .slice(0, visibleCount)
              .map((product) => (
                <div
                  key={product.productId}
                  className="product-list-item"
                  onClick={() => {}}
                >
                  <ProductImage product={product} />
                  <div className="product-details">
                    <div
                      className="title-row"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <h3 style={{ margin: 0, fontSize: "1.05rem", flex: 1 }}>
                        {product.productName}
                      </h3>
                      <button
                        type="button"
                        className="status-toggle compact"
                        onClick={(e) => handleToggleStatus(e, product)}
                        disabled={statusUpdatingId === product.productId}
                        aria-pressed={!!product.isActive}
                        aria-label={
                          product.isActive
                            ? "Deactivate product"
                            : "Activate product"
                        }
                        style={{ marginLeft: 4 }}
                      >
                        <span className="toggle-track">
                          <span
                            className={
                              "toggle-thumb" +
                              (product.isActive ? " active" : "")
                            }
                          ></span>
                        </span>
                        <span className="toggle-label">
                          {statusUpdatingId === product.productId
                            ? "..."
                            : product.isActive
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </button>
                    </div>
                    <div
                      className="product-meta"
                      style={{
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: 4,
                      }}
                    >
                      <span>
                        Rate: ₹{product.rate} / {product.unit}
                      </span>
                      <span>
                        Available: {product.availableQuantity} {product.unit}
                      </span>
                      <span>Sold: {product.soldedQuantity ?? 0}</span>
                      <span>Category: {product.category}</span>
                      <span>City: {product.city || "-"}</span>
                      <span>
                        Province: {product.province || product.provience || "-"}
                      </span>
                      <span>Country: {product.country || "-"}</span>
                    </div>
                  </div>
                  <div className="product-actions compact-actions">
                    <button
                      className="edit-btn"
                      onClick={(e) => handleEditClick(e, product)}
                    >
                      ✏️ Update
                    </button>
                    <button
                      className="delete-btn"
                      onClick={(e) => handleDeleteClick(e, product.productId)}
                      disabled={isDeleting}
                    >
                      🗑️ {isDeleting ? "..." : "Delete"}
                    </button>
                  </div>
                </div>
              ))
          )}
        </div>
        {/* Sentinel for reveal-on-scroll */}
        {products.filter((p) => {
          if (!searchTerm.trim()) return true;
          const t = searchTerm.toLowerCase();
          return (
            (p.productName || "").toLowerCase().includes(t) ||
            (p.category || "").toLowerCase().includes(t) ||
            (p.city || "").toLowerCase().includes(t)
          );
        }).length > 0 && (
          <>
            <div ref={sentinelRef} className="infinite-sentinel" />
            {visibleCount <
              products.filter((p) => {
                if (!searchTerm.trim()) return true;
                const t = searchTerm.toLowerCase();
                return (
                  (p.productName || "").toLowerCase().includes(t) ||
                  (p.category || "").toLowerCase().includes(t) ||
                  (p.city || "").toLowerCase().includes(t)
                );
              }).length && (
              <div className="infinite-loader">Loading more...</div>
            )}
          </>
        )}
        {isEditing && (
          <div className="edit-form-modal">
            <form onSubmit={handleUpdateProduct} className="product-form">
              <h2>Edit Product</h2>
              {editError && (
                <div className="edit-error-message">{editError}</div>
              )}
              <div className="form-group">
                <label htmlFor="edit_productName">Product Name</label>
                <input
                  id="edit_productName"
                  type="text"
                  name="productName"
                  value={editFormData.productName}
                  onChange={handleInputChange}
                  placeholder="Enter product name"
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit_rate">Rate</label>
                <input
                  id="edit_rate"
                  type="number"
                  name="rate"
                  value={editFormData.rate}
                  onChange={handleInputChange}
                  placeholder="Enter price"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit_availableQuantity">
                  Available Quantity
                </label>
                <input
                  id="edit_availableQuantity"
                  type="number"
                  name="availableQuantity"
                  value={editFormData.availableQuantity}
                  onChange={handleInputChange}
                  placeholder="Enter quantity"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit_category">Category</label>
                <select
                  id="edit_category"
                  name="category"
                  value={editFormData.category}
                  onChange={handleInputChange}
                >
                  <option value="">-- Keep Existing --</option>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="edit_unit">Unit</label>
                <select
                  id="edit_unit"
                  name="unit"
                  value={editFormData.unit}
                  onChange={handleInputChange}
                >
                  <option value="">-- Keep Existing --</option>
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="quintal">quintal</option>
                  <option value="litre">litre</option>
                  <option value="ml">ml</option>
                  <option value="piece">piece</option>
                  <option value="dozen">dozen</option>
                  <option value="packet">packet</option>
                  <option value="sack">sack</option>
                  <option value="box">box</option>
                  <option value="other">other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Location</label>
                <button
                  type="button"
                  onClick={() => setShowLocationModal(true)}
                  style={{ marginBottom: 8 }}
                >
                  {editLocation.latitude && editLocation.longitude
                    ? "Change Location"
                    : "Select Location"}
                </button>
                {editLocation.latitude && editLocation.longitude && (
                  <div style={{ color: "#2d7a2d", fontSize: 14 }}>
                    Location selected
                  </div>
                )}
                <input
                  type="text"
                  name="location"
                  value={editFormData.location}
                  onChange={handleInputChange}
                  placeholder="Optional textual location"
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit_description">Description</label>
                <textarea
                  id="edit_description"
                  name="description"
                  value={editFormData.description}
                  onChange={handleInputChange}
                  placeholder="Describe the product"
                  rows="4"
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit_image">Image</label>
                <input
                  id="edit_image"
                  type="file"
                  name="image"
                  onChange={handleInputChange}
                  accept="image/*"
                />
              </div>
              <div style={{ fontSize: 12, color: "#555", lineHeight: 1.4 }}>
                Leave blank to keep existing values.
              </div>
              <div className="form-actions">
                <button type="submit">Update</button>
                <button type="button" onClick={() => setIsEditing(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
      <Footer />
      {showLocationModal && (
        <div
          className="bulk-order-modal-overlay"
          onClick={() => setShowLocationModal(false)}
        >
          <div
            className="bulk-order-modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 600 }}
          >
            <div
              className="bulk-order-modal-header"
              style={{ background: "#2d7a2d", color: "#fff" }}
            >
              <h2 style={{ fontSize: "1.2rem" }}>Select Location</h2>
              <button
                className="close-btn"
                onClick={() => setShowLocationModal(false)}
              >
                &times;
              </button>
            </div>
            <div className="bulk-order-modal-body">
              <LocationPicker
                latitude={editLocation.latitude}
                longitude={editLocation.longitude}
                address={editLocation.address}
                onLocationChange={setEditLocation}
              />
              <div style={{ textAlign: "right", marginTop: 16 }}>
                <button
                  type="button"
                  className="dashboard-button"
                  onClick={() => setShowLocationModal(false)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyProducts;
