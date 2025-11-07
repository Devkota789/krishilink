import React from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import DashboardNavbar from "../components/DashboardNavbar";
import Navbar from "../components/Navbar";

// Layout to keep the navbar persistent across dashboard pages
const DashboardLayout = () => {
  const { user } = useAuth();
  const showDashboardNav = user?.role === "farmer" || user?.role === "seller";

  return (
    <div className="dashboard-layout">
      {showDashboardNav ? <DashboardNavbar /> : <Navbar />}
      <div className="dashboard-layout-body">
        <Outlet />
      </div>
    </div>
  );
};

export default DashboardLayout;
