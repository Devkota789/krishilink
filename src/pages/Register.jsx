import React, { useState } from "react";
import Navbar from "../components/Navbar";
import "./Register.css";
import { useNavigate } from "react-router-dom";
import { authAPI } from "../api/api";
import LocationPicker from "../components/LocationPicker";
import "../components/BulkOrderModal.css";

const Register = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    address: "",
    city: "",
    state: "",
    password: "",
    confirmPassword: "",
    role: "farmer",
    image: null,
  });

  const [message, setMessage] = useState({ text: "", type: "" });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [location, setLocation] = useState({
    latitude: "",
    longitude: "",
    address: "",
  });
  const [showLocationModal, setShowLocationModal] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setFormData((prevState) => ({
      ...prevState,
      image: file,
    }));
  };

  const validateForm = () => {
    if (!formData.fullName) {
      setMessage({ text: "Full name is required", type: "error" });
      return false;
    }
    if (!formData.email && !formData.phoneNumber) {
      setMessage({
        text: "Either email or phone number is required",
        type: "error",
      });
      return false;
    }
    if (formData.email && !validateEmail(formData.email)) {
      setMessage({ text: "Please enter a valid email address", type: "error" });
      return false;
    }
    if (formData.phoneNumber && !validatePhone(formData.phoneNumber)) {
      setMessage({
        text: "Please enter a valid 10-digit phone number",
        type: "error",
      });
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setMessage({ text: "Passwords do not match", type: "error" });
      return false;
    }
    if (formData.password.length < 6) {
      setMessage({
        text: "Password must be at least 6 characters long",
        type: "error",
      });
      return false;
    }
    return true;
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone) => {
    const phoneRegex = /^[0-9]{10}$/;
    return phoneRegex.test(phone);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: "", type: "" });

    if (!validateForm()) {
      setLoading(false);
      return;
    }

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("FullName", formData.fullName);
      if (formData.email) formDataToSend.append("Email", formData.email);
      if (formData.phoneNumber)
        formDataToSend.append("PhoneNumber", formData.phoneNumber);
      formDataToSend.append("Password", formData.password);
      formDataToSend.append("ConfirmPassword", formData.confirmPassword);
      formDataToSend.append("Role", formData.role);
      formDataToSend.append(
        "DeviceId",
        "web-" + Math.random().toString(36).substring(2)
      );
      // Only include latitude/longitude if present
      if (location.latitude && location.longitude) {
        formDataToSend.append("Latitude", location.latitude);
        formDataToSend.append("Longitude", location.longitude);
      }
      // Optional fields
      if (formData.address) formDataToSend.append("Address", formData.address);
      if (formData.city) formDataToSend.append("City", formData.city);
      if (formData.state) formDataToSend.append("State", formData.state);
      if (formData.image) formDataToSend.append("Image", formData.image);

      const response = await authAPI.registerUser(formDataToSend);

      setMessage({
        text: "Registration successful! Please login.",
        type: "success",
      });
      // Reset form
      setFormData({
        fullName: "",
        email: "",
        phoneNumber: "",
        address: "",
        city: "",
        state: "",
        password: "",
        confirmPassword: "",
        role: "farmer",
        image: null,
      });
      setLocation({ latitude: "", longitude: "", address: "" });
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (error) {
      console.error("Registration error:", error);
      let errorMessage = "Registration failed. Please try again.";
      if (error.response?.data) {
        const errorData = error.response.data;
        if (errorData.errors) {
          errorMessage = Object.values(errorData.errors).flat().join(" ");
        } else if (errorData.title) {
          errorMessage = errorData.title;
        } else if (typeof errorData === "string") {
          errorMessage = errorData;
        }
      }
      setMessage({ text: errorMessage, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <Navbar />
      <div className="register-container">
        <h1>Join Krishilink</h1>
        <div className="register-form-container">
          <form onSubmit={handleSubmit} className="register-form">
            <div className="form-group">
              <label htmlFor="fullName">Full Name *</label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                required
                placeholder="Enter your full name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="phoneNumber">Phone Number</label>
              <input
                type="tel"
                id="phoneNumber"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                placeholder="Enter your 10-digit phone number"
                pattern="[0-9]{10}"
              />
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
                <div
                  style={{ color: "#2d7a2d", fontSize: 14, marginBottom: 4 }}
                >
                  Location selected
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="password">Password *</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="Enter your password"
                minLength="6"
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password *</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                placeholder="Confirm your password"
                minLength="6"
              />
            </div>

            <div className="form-group">
              <label htmlFor="role">Role *</label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                required
              >
                <option value="farmer">Farmer</option>
                <option value="buyer">Buyer</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="image">Profile Image</label>
              <input
                type="file"
                id="image"
                name="image"
                onChange={handleImageChange}
                accept="image/*"
              />
            </div>

            {message.text && (
              <div
                className={`message ${message.type}`}
                style={{ marginBottom: "1rem" }}
              >
                {message.text}
              </div>
            )}

            <button
              type="submit"
              className="register-button"
              disabled={loading}
            >
              {loading ? "Registering..." : "Register"}
            </button>
          </form>
        </div>
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
                  className="register-button"
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

export default Register;
