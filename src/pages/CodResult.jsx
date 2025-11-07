import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import DashboardNavbar from "../components/DashboardNavbar";
import { useAuth } from "../context/AuthContext";

// Full-page viewer for COD HTML content returned by the API
export default function CodResult() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [html, setHtml] = useState("");

  const htmlKey = location.state?.htmlKey || null;
  const inlineHtml = location.state?.html || null;

  useEffect(() => {
    // Prefer inline HTML if provided; otherwise look up by key from sessionStorage
    if (inlineHtml && typeof inlineHtml === "string") {
      setHtml(inlineHtml);
      return;
    }
    if (htmlKey) {
      try {
        const stored = sessionStorage.getItem(htmlKey);
        if (stored) setHtml(stored);
      } catch {}
    }
  }, [htmlKey, inlineHtml]);

  // For full-screen content, we intentionally skip rendering any nav or footer.

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      {html ? (
        <iframe
          title="COD Result"
          srcDoc={html}
          style={{ width: "100%", height: "100%", border: "none" }}
        />
      ) : (
        <div style={{ padding: 24 }}>
          <h2>No COD content available</h2>
          <p>Please go back and try placing your order again.</p>
          <button
            className="back-btn"
            onClick={() => navigate("/dashboard/checkout", { replace: true })}
          >
            Back to Checkout
          </button>
        </div>
      )}
    </div>
  );
}
