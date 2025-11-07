import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import DashboardNavbar from "../components/DashboardNavbar";
import Footer from "../components/Footer";
import { productAPI } from "../api/api";
import "./AddProduct.css";
import LocationPicker from "../components/LocationPicker";
import "../components/BulkOrderModal.css";

const AddProduct = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [location, setLocation] = useState({
    latitude: "",
    longitude: "",
    address: "",
  });

  const [formData, setFormData] = useState({
    productName: "",
    rate: "",
    availableQuantity: "",
    category: "Vegetables",
    unit: "kg",
    description: "",
  });

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [showLocationModal, setShowLocationModal] = useState(false);

  if (!user) {
    return (
      <div className="add-product-page">
        <div className="unauthorized">
          <p>Please log in to add products.</p>
        </div>
      </div>
    );
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setMessage({
          type: "error",
          text: "Please select a valid image file.",
        });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setMessage({
          type: "error",
          text: "Image size should be less than 5MB.",
        });
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target.result);
      reader.readAsDataURL(file);
      setMessage({ type: "", text: "" });
    }
  };

  const validateForm = () => {
    if (!formData.productName.trim()) {
      setMessage({ type: "error", text: "Product name is required." });
      return false;
    }
    if (!formData.rate || parseFloat(formData.rate) <= 0) {
      setMessage({ type: "error", text: "Please enter a valid rate." });
      return false;
    }
    if (
      !formData.availableQuantity ||
      parseFloat(formData.availableQuantity) <= 0
    ) {
      setMessage({ type: "error", text: "Please enter a valid quantity." });
      return false;
    }
    if (!formData.category.trim()) {
      setMessage({ type: "error", text: "Category is required." });
      return false;
    }
    if (!formData.unit.trim()) {
      setMessage({ type: "error", text: "Unit is required." });
      return false;
    }
    if (!location.latitude || !location.longitude) {
      setMessage({
        type: "error",
        text: "Please select a location on the map.",
      });
      return false;
    }
    if (!imageFile) {
      setMessage({ type: "error", text: "Please select an image." });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("ProductName", formData.productName ?? "");
      formDataToSend.append("Image", imageFile ?? "");
      formDataToSend.append(
        "Rate",
        formData.rate !== undefined && formData.rate !== null
          ? formData.rate
          : ""
      );
      formDataToSend.append("Unit", formData.unit ?? "kg");
      formDataToSend.append(
        "AvailableQuantity",
        formData.availableQuantity !== undefined &&
          formData.availableQuantity !== null
          ? formData.availableQuantity
          : ""
      );
      formDataToSend.append("Category", formData.category ?? "");
      formDataToSend.append("Latitude", location.latitude);
      formDataToSend.append("Longitude", location.longitude);
      if (formData.description && formData.description.trim()) {
        formDataToSend.append("Description", formData.description.trim());
      }

      // Debug: log all FormData key-value pairs
      for (let [key, value] of formDataToSend.entries()) {
        console.log("FormData:", key, value);
      }

      // Debug log: show the token being used from either storage
      const token =
        (typeof sessionStorage !== "undefined" &&
          sessionStorage.getItem("authToken")) ??
        localStorage.getItem("authToken");
      console.log(
        "Token used for addProduct:",
        token ? token.substring(0, 30) + "..." : "No token"
      );

      // Our axios instance sets Authorization automatically; only set content type here
      const config = {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      };

      const result = await productAPI.addProduct(formDataToSend, config);
      if (result.success) {
        setMessage({
          type: "success",
          text:
            result.data && typeof result.data === "string"
              ? result.data
              : "Product added successfully! Redirecting to dashboard...",
        });
        setFormData({
          productName: "",
          rate: "",
          availableQuantity: "",
          category: "",
          unit: "",
          description: "",
        });
        setLocation({ latitude: "", longitude: "", address: "" });
        setImageFile(null);
        setImagePreview(null);
        setTimeout(() => navigate("/dashboard"), 2000);
      } else {
        let errorMsg = result.error || "Failed to add product.";
        if (
          Array.isArray(result.errorDetails) &&
          result.errorDetails.length > 0
        ) {
          errorMsg += "\n" + result.errorDetails.join("\n");
        }
        setMessage({ type: "error", text: errorMsg });
      }
    } catch (error) {
      console.error("Error adding product:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data ||
        error.message ||
        "Failed to add product.";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-product-page">
      <DashboardNavbar />

      <div className="add-product-container">
        <div className="button-container">
          <button
            className="dashboard-button"
            onClick={() => navigate("/dashboard")}
          >
            ← Back to Dashboard
          </button>
        </div>

        <h1>Add New Product</h1>

        <form className="product-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="productName">Product Name *</label>
            <input
              type="text"
              id="productName"
              name="productName"
              value={formData.productName}
              onChange={handleInputChange}
              placeholder="Enter product name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="image">Product Image *</label>
            <input
              type="file"
              id="image"
              name="image"
              accept="image/*"
              onChange={handleImageChange}
              required
            />
            {imagePreview && (
              <div style={{ marginTop: "10px" }}>
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{
                    maxWidth: "200px",
                    maxHeight: "200px",
                    objectFit: "cover",
                    border: "1px solid #ddd",
                    borderRadius: "5px",
                  }}
                />
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="rate">Rate (Price) *</label>
            <input
              type="number"
              id="rate"
              name="rate"
              value={formData.rate}
              onChange={handleInputChange}
              placeholder="Enter price"
              min="0"
              step="0.01"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="availableQuantity">Available Quantity *</label>
            <input
              type="number"
              id="availableQuantity"
              name="availableQuantity"
              value={formData.availableQuantity}
              onChange={handleInputChange}
              placeholder="Enter available quantity"
              min="0"
              step="0.01"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="category">Category *</label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              required
            >
              <option value="Vegetables">Vegetables</option>
              <option value="Fruits">Fruits</option>
              <option value="Grains">Grains</option>
              <option value="Dairy">Dairy</option>
              <option value="Livestock">Livestock</option>
              <option value="Seeds">Seeds</option>
              <option value="Spices & Herbs">Spices & Herbs</option>
              <option value="Flowers & Plants">Flowers & Plants</option>
              <option value="Pulses & Legumes">Pulses & Legumes</option>
              <option value="Nuts">Nuts</option>
              <option value="Beverages">Beverages</option>
              <option value="Fish & Seafood">Fish & Seafood</option>
              <option value="Eggs & Poultry">Eggs & Poultry</option>
              <option value="Honey & Bee Products">Honey & Bee Products</option>
              <option value="Organic Products">Organic Products</option>
              <option value="Tools">Tools</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="unit">Unit *</label>
            <select
              id="unit"
              name="unit"
              value={formData.unit}
              onChange={handleInputChange}
              required
            >
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
            <label>Location *</label>
            <button
              type="button"
              onClick={() => setShowLocationModal(true)}
              style={{ marginBottom: 8 }}
            >
              {location.latitude && location.longitude
                ? "Change Location"
                : "Select Location"}
            </button>
            {location.latitude && location.longitude && (
              <div style={{ color: "#2d7a2d", fontSize: 14, marginBottom: 4 }}>
                Location selected
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Enter product description (optional)"
              rows="4"
            />
          </div>

          {message.text && (
            <div className={`message ${message.type}`}>{message.text}</div>
          )}
          <button type="submit" className="submit-button" disabled={loading}>
            {loading ? "Adding Product..." : "Add Product"}
          </button>
        </form>
      </div>
      {/* Location Picker Modal */}
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
              style={{ background: "#2d7a2d", color: "white" }}
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
                latitude={location.latitude}
                longitude={location.longitude}
                address={location.address}
                onLocationChange={setLocation}
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
      <Footer />
    </div>
  );
};

export default AddProduct;
