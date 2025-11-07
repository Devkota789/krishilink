import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import "./AdminSidebar.css";

// Optional props allow pages to hide the default header/nav without affecting other pages.
const AdminSidebar = ({
  children,
  hideHeader = false,
  hideDefaultNav = false,
}) => {
  const { pathname } = useLocation();
  const usersActive =
    pathname.startsWith("/dashboard/users") ||
    pathname.startsWith("/dashboard/admin/farmers") ||
    pathname.startsWith("/dashboard/admin/users") ||
    pathname.startsWith("/dashboard/admin/buyers");
  const ordersActive = pathname.startsWith("/dashboard/admin/orders");
  const paymentsActive = pathname.startsWith("/dashboard/admin/payments");
  const reviewsActive = pathname.startsWith("/dashboard/admin/reviews");
  return (
    <aside className="admin-sidebar" aria-label="Admin navigation">
      {!hideHeader && <div className="admin-sidebar-header">Admin</div>}
      {!hideDefaultNav && (
        <nav className="admin-sidebar-nav">
          <NavLink
            to="/dashboard/users"
            className={`admin-side-link ${usersActive ? "active" : ""}`}
          >
            Users
          </NavLink>
          <NavLink
            to="/dashboard/admin/orders"
            className={`admin-side-link ${ordersActive ? "active" : ""}`}
          >
            Orders
          </NavLink>
          <NavLink
            to="/dashboard/admin/payments"
            className={`admin-side-link ${paymentsActive ? "active" : ""}`}
          >
            Payments
          </NavLink>
          <NavLink
            to="/dashboard/admin/reviews"
            className={`admin-side-link ${reviewsActive ? "active" : ""}`}
          >
            Product Reviews
          </NavLink>
        </nav>
      )}
      {children && (
        <div style={{ marginTop: 12 }} className="admin-sidebar-extra">
          {children}
        </div>
      )}
    </aside>
  );
};

export default AdminSidebar;
