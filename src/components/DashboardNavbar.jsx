import React, { useState, useRef, useEffect } from "react";
import { useNavigate, Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import krishilinkLogo from "../assets/Images/krishilink.jpg";
import "./DashboardNavbar.css";
import "./Navbar.css"; // reuse brand & ornament styles
import { userAPI } from "../api/api";
import {
  FaShoppingCart,
  FaUserCircle,
  FaSignOutAlt,
  FaCog,
} from "react-icons/fa";

const DashboardNavbar = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarError, setAvatarError] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch user avatar
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await userAPI.getUserImage();
        if (!mounted) return;
        if (res?.data instanceof Blob) {
          const url = URL.createObjectURL(res.data);
          setAvatarUrl(url);
        }
      } catch (e) {
        if (mounted) setAvatarError(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const initials = (user?.fullName || user?.name || "U")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <nav className="navbar">
      {/* Decorative ornaments to match main navbar */}
      <div className="nav-ornament tl" aria-hidden="true">
        <span className="leaf l1" />
        <span className="leaf l2" />
        <span className="grain g1" />
      </div>
      <div className="nav-ornament tr" aria-hidden="true">
        <span className="leaf l1" />
        <span className="leaf l2" />
        <span className="grain g2" />
      </div>
      <div className="nav-ornament bl" aria-hidden="true">
        <span className="sprout" />
      </div>
      <div className="nav-ornament br" aria-hidden="true">
        <span className="sprout delay" />
      </div>
      <div className="agri-ambient" aria-hidden="true" />
      <div
        className="navbar-container"
        style={{ position: "relative", zIndex: 10 }}
      >
        <Link
          to="/dashboard"
          className="brand-block"
          aria-label="KrishiLink Dashboard Home"
        >
          <div className="brand-logo-wrapper">
            <img src={krishilinkLogo} alt="KrishiLink" loading="lazy" />
          </div>
          <div className="brand-text">
            <span className="brand-title">KrishiLink</span>
          </div>
        </Link>
        <div
          className="navbar-links"
          style={{ display: "flex", alignItems: "center", gap: "1.75rem" }}
        >
          <NavLink
            to="/dashboard"
            end
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          >
            Dashboard
          </NavLink>
          {user?.role === "farmer" && (
            <>
              <NavLink
                to="/dashboard/my-products"
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                My Products
              </NavLink>
              {/* Moved Add Product to sidebar inside dashboard */}
            </>
          )}
          {/* Marketplace routes to Products page */}
          <NavLink
            to="/products"
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          >
            Marketplace
          </NavLink>
          {/* My Orders visible for all authenticated users */}
          <NavLink
            to="/dashboard/my-orders"
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          >
            My Orders
          </NavLink>
          <NavLink
            to="/dashboard/cart"
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          >
            <FaShoppingCart className="cart-icon" aria-hidden="true" />
            <span>Cart</span>
          </NavLink>
        </div>

        <div
          className="navbar-auth"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            position: "relative",
          }}
        >
          <button
            onClick={() => setProfileOpen((o) => !o)}
            aria-haspopup="true"
            aria-expanded={profileOpen}
            className="user-avatar-btn"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
            }}
            title="Profile menu"
          >
            <div
              className="avatar-circle"
              style={{
                width: 46,
                height: 46,
                borderRadius: "50%",
                background: avatarUrl
                  ? "#fff"
                  : "linear-gradient(135deg,#e8f5e9,#c8e6c9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 600,
                color: avatarUrl ? "#1a237e" : "#2e7d32",
                boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
                fontSize: avatarUrl ? 0 : 18,
                letterSpacing: 0.5,
                border: "2px solid #0d47a1",
                overflow: "hidden",
              }}
            >
              {avatarUrl && !avatarError ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  onError={() => setAvatarError(true)}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                initials
              )}
            </div>
          </button>
          {profileOpen && (
            <div
              ref={dropdownRef}
              className="user-dropdown"
              role="menu"
              style={{
                position: "absolute",
                top: "56px",
                right: 0,
                minWidth: "240px",
                background: "#fff",
                borderRadius: "12px",
                boxShadow: "0 8px 24px -4px rgba(0,0,0,0.18)",
                padding: "0.85rem 0.9rem 0.95rem",
                border: "1px solid #e0e0e0",
                animation: "fadeIn 0.18s ease",
                zIndex: 2000,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.35rem 0.25rem 0.85rem",
                  borderBottom: "1px solid #eee",
                  marginBottom: "0.55rem",
                }}
              >
                <FaUserCircle style={{ fontSize: 34, color: "#2e7d32" }} />
                <div style={{ lineHeight: 1.2 }}>
                  <div style={{ fontWeight: 600, color: "#2e7d32" }}>
                    {user?.fullName || user?.name || "User"}
                  </div>
                  <small
                    style={{
                      background: "#e8f5e9",
                      padding: "2px 8px",
                      borderRadius: 12,
                      fontSize: 11,
                      letterSpacing: 0.5,
                      color: "#2e7d32",
                      textTransform: "uppercase",
                    }}
                  >
                    {user?.role}
                  </small>
                </div>
              </div>
              <button
                onClick={() => {
                  setProfileOpen(false);
                  navigate("/dashboard");
                }}
                className="dropdown-link"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.55rem",
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  textAlign: "left",
                  padding: "0.55rem 0.65rem",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  color: "#2e7d32",
                  borderRadius: 8,
                }}
              >
                <FaCog /> Settings
              </button>
              <button
                onClick={handleLogout}
                className="dropdown-link danger"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  width: "100%",
                  background: "linear-gradient(135deg,#fbe9e7,#ffccbc)",
                  border: "1px solid #ffc1a6",
                  textAlign: "left",
                  padding: "0.6rem 0.7rem",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  color: "#d84315",
                  borderRadius: 10,
                  marginTop: "0.35rem",
                  fontWeight: 600,
                }}
              >
                <FaSignOutAlt /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default DashboardNavbar;
