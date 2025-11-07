import React, { useEffect, useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaBars,
  FaTimes,
  FaUserCircle,
  FaSignOutAlt,
  FaShoppingBasket,
  FaShoppingCart,
  FaCog,
  FaTractor,
  FaSeedling,
  FaClipboardList,
  FaCreditCard,
} from "react-icons/fa";
import krishilinkLogo from "../assets/Images/krishilink.jpg";
import { useAuth } from "../context/AuthContext";
import { userAPI } from "../api/api";
import "./Navbar.css";

const Navbar = () => {
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarError, setAvatarError] = useState(false);
  // Removed search & CTA for now per request
  const location = useLocation();

  // Close menu with ESC and lock body scroll when menu is open on mobile/tablet
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setProfileOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);

    // Simple scroll lock for small screens
    if (menuOpen && window.matchMedia("(max-width: 1024px)").matches) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
        window.removeEventListener("keydown", onKey);
      };
    }
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close menus when route changes
  useEffect(() => {
    setMenuOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  // Fetch user avatar image (same logic as DashboardNavbar)
  useEffect(() => {
    let mounted = true;
    if (!user) return;
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
  }, [user]);

  // Placeholder for future search handler
  const handleSearchSubmit = (e) => e.preventDefault();

  const displayName =
    user?.fullName || user?.name || user?.emailOrPhone || user?.email || "User";
  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <nav className={`navbar ${scrolled ? "scrolled" : ""}`}>
      {/* Restored decorative animated corners */}
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
      <div className="navbar-inner-wrapper">
        <div className="navbar-left">
          <Link to="/" className="brand-block" aria-label="KrishiLink Home">
            <div className="brand-logo-wrapper">
              <img src={krishilinkLogo} alt="KrishiLink" loading="lazy" />
            </div>
            <div className="brand-text">
              <span className="brand-title">KrishiLink</span>
            </div>
          </Link>
        </div>

        <div
          id="primary-navigation"
          aria-label="Primary"
          role="navigation"
          className={`nav-links-wrapper ${menuOpen ? "open" : ""}`}
        >
          {user?.role === "admin" ? (
            <>
              <NavLink
                to="/dashboard"
                end
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/products"
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                Marketplace
              </NavLink>
              <NavLink
                to="/dashboard/admin/orders"
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                <FaClipboardList className="menu-icon" aria-hidden="true" />
                <span>Orders</span>
              </NavLink>
              <NavLink
                to="/dashboard/admin/payments"
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                <FaCreditCard className="menu-icon" aria-hidden="true" />
                <span>Payment</span>
              </NavLink>
            </>
          ) : user?.role === "buyer" || user?.role === "farmer" ? (
            <>
              <NavLink
                to="/dashboard"
                end
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/products"
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                Marketplace
              </NavLink>
              <NavLink
                to="/dashboard/my-orders"
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                My Orders
              </NavLink>
              <NavLink
                to="/dashboard/cart"
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                <FaShoppingCart className="cart-icon" aria-hidden="true" />
                <span>Cart</span>
              </NavLink>
            </>
          ) : (
            <>
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                Home
              </NavLink>
              <NavLink
                to="/products"
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                Marketplace
              </NavLink>
              <NavLink
                to="/why-us"
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                Why Us
              </NavLink>
              <NavLink
                to="/contact"
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                Contact
              </NavLink>
              <NavLink
                to="/cart"
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                <FaShoppingCart className="cart-icon" aria-hidden="true" />
                <span>Cart</span>
              </NavLink>
            </>
          )}

          {/* Auth and user actions (mobile/tablet only) */}
          {!loading && !user && (
            <Link
              to="/login"
              className="nav-link mobile-only"
              onClick={() => setMenuOpen(false)}
            >
              Login
            </Link>
          )}
          {!loading && user && (
            <div
              className="mobile-only"
              style={{
                borderTop: "1px solid #e0e0e0",
                marginTop: ".25rem",
                paddingTop: ".25rem",
              }}
            >
              <button
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/dashboard");
                }}
                className="dropdown-link"
                style={{ width: "100%" }}
              >
                <FaCog /> Settings
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
                className="dropdown-link danger"
                style={{ width: "100%" }}
              >
                <FaSignOutAlt /> Logout
              </button>
            </div>
          )}
        </div>

        {/* Translucent overlay to close the menu on mobile/tablet */}
        <button
          type="button"
          aria-hidden={!menuOpen}
          tabIndex={menuOpen ? 0 : -1}
          className={`nav-overlay ${menuOpen ? "open" : ""}`}
          onClick={() => setMenuOpen(false)}
        />

        <div className="navbar-right">
          {/* Hamburger on the right for tablet/mobile */}
          <button
            className="nav-hamburger"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-controls="primary-navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            type="button"
          >
            {menuOpen ? <FaTimes /> : <FaBars />}
          </button>

          {/* Future: search (desktop) */}

          {!loading && !user && (
            <div className="auth-buttons single">
              <Link to="/login" className="btn-outline btn-login">
                Login
              </Link>
            </div>
          )}
          {!loading && user && (
            <div className="user-menu-wrapper">
              <button
                className="user-avatar-btn"
                onClick={() => setProfileOpen((o) => !o)}
                aria-haspopup="true"
                aria-expanded={profileOpen}
                aria-label="User menu"
              >
                <div
                  className="avatar-circle"
                  title={displayName}
                  style={
                    user?.role === "buyer"
                      ? {
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
                        }
                      : undefined
                  }
                >
                  {avatarUrl && !avatarError ? (
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      onError={() => setAvatarError(true)}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    initials
                  )}
                </div>
              </button>
              {profileOpen && (
                <div
                  className="user-dropdown"
                  role="menu"
                  style={
                    user?.role === "buyer"
                      ? {
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
                        }
                      : undefined
                  }
                >
                  {user?.role === "buyer" ? (
                    <>
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
                        <FaUserCircle
                          style={{ fontSize: 34, color: "#2e7d32" }}
                        />
                        <div style={{ lineHeight: 1.2 }}>
                          <div style={{ fontWeight: 600, color: "#2e7d32" }}>
                            {displayName}
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
                            {user.role}
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
                        onClick={logout}
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
                    </>
                  ) : (
                    <>
                      <div className="user-info-block">
                        <FaUserCircle />
                        <div>
                          <strong>{displayName}</strong>
                          {user.role && (
                            <small className="role-pill">{user.role}</small>
                          )}
                        </div>
                      </div>
                      <div className="divider" />
                      <Link
                        to="/dashboard"
                        className="dropdown-link"
                        role="menuitem"
                      >
                        <FaTractor /> Dashboard
                      </Link>
                      {user.role === "seller" && (
                        <Link
                          to="/my-products"
                          className="dropdown-link"
                          role="menuitem"
                        >
                          <FaSeedling /> My Products
                        </Link>
                      )}
                      {(user.role === "buyer" || user.role === "farmer") && (
                        <Link
                          to="/dashboard/my-orders"
                          className="dropdown-link"
                          role="menuitem"
                        >
                          <FaShoppingBasket /> My Orders
                        </Link>
                      )}
                      <button
                        className="dropdown-link danger"
                        onClick={logout}
                        role="menuitem"
                      >
                        <FaSignOutAlt /> Logout
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
