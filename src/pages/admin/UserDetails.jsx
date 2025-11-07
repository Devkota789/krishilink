import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import "./UserDetails.css";
import { userAPI } from "../../api/api";

const safe = (v) => (v === null || v === undefined || v === "" ? "-" : v);

const labelMap = {
  id: "User ID",
  Id: "User ID",
  fullName: "Full Name",
  FullName: "Full Name",
  name: "Name",
  Name: "Name",
  email: "Email",
  Email: "Email",
  phoneNumber: "Phone",
  PhoneNumber: "Phone",
  phone: "Phone",
  Phone: "Phone",
  address: "Address",
  Address: "Address",
  City: "City",
  Province: "Province",
  Country: "Country",
  role: "Role",
  Role: "Role",
  isActive: "Status",
  IsActive: "Status",
  IsBlocked: "Blocked",
  ReputationCount: "Reputation Count",
  ReportCount: "Report Count",
  ImageCode: "Image Code",
  createdAt: "Created At",
  CreatedAt: "Created At",
  lastLogin: "Last Login",
  LastLogin: "Last Login",
  totalProducts: "Total Products",
  totalMoneySpend: "Total Money Spent",
  totalProductsSold: "Total Products Sold",
};

export default function UserDetails() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    let revokeUrl = null;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await userAPI.getUserDetailsById(userId);
        if (res?.success) {
          const d = res.data || {};
          setData(d);
          if (d.imageUrl) {
            setImageUrl(d.imageUrl);
          } else if (d.imageBase64) {
            const url = `data:image/png;base64,${d.imageBase64}`;
            setImageUrl(url);
          } else {
            try {
              const imgResp = await userAPI.getUserImageById(userId);
              const blob = imgResp?.data;
              if (blob && blob.size > 0) {
                const url = URL.createObjectURL(blob);
                revokeUrl = url;
                setImageUrl(url);
              }
            } catch {}
          }
        } else {
          setError(res?.error || "Failed to load user details");
        }
      } catch (e) {
        setError(e?.message || "Failed to load user details");
      } finally {
        setLoading(false);
      }
    };
    run();
    return () => {
      if (revokeUrl) URL.revokeObjectURL(revokeUrl);
    };
  }, [userId]);

  const initial = useMemo(() => {
    const name =
      data?.FullName || data?.fullName || data?.Name || data?.name || "?";
    return name.trim().charAt(0).toUpperCase();
  }, [data]);

  const allFields = useMemo(() => {
    if (!data || typeof data !== "object") return [];
    const entries = Object.entries(data).map(([key, value]) => {
      let display = value;
      if (value === null || value === undefined || value === "") display = "-";
      else if (typeof value === "boolean") display = value ? "Yes" : "No";
      else if (typeof value === "object") {
        try {
          display = JSON.stringify(value);
        } catch {
          display = String(value);
        }
      }
      const text = String(display);
      const truncated = text.length > 300 ? text.slice(0, 300) + "…" : text;
      return { key, value: truncated, title: text };
    });
    const order = [
      "Id",
      "id",
      "FullName",
      "fullName",
      "Name",
      "name",
      "Email",
      "email",
    ];
    entries.sort((a, b) => {
      const ai = order.indexOf(a.key);
      const bi = order.indexOf(b.key);
      if (ai !== -1 || bi !== -1)
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return a.key.localeCompare(b.key);
    });
    return entries;
  }, [data]);

  return (
    <div
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      <Navbar />
      <main style={{ paddingTop: 90, flex: 1 }}>
        <div className="user-details-wrap">
          <div className="user-details-card">
            <div className="details-header">
              <div className="avatar">
                {imageUrl ? (
                  <img src={imageUrl} alt="user" />
                ) : (
                  <div className="avatar-fallback">{initial}</div>
                )}
              </div>
              <div className="head-text">
                <h1 className="title">User Details</h1>
                <div className="sub">Overview and printable summary</div>
              </div>
              <div className="head-actions">
                <button className="btn" onClick={() => window.print()}>
                  Print
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => navigate("/dashboard/users")}
                >
                  Back
                </button>
              </div>
            </div>

            {loading ? (
              <div className="loading">Loading details…</div>
            ) : error ? (
              <div className="error">{error}</div>
            ) : (
              <div className="details-body">
                <div className="grid">
                  {allFields.map((f) => (
                    <div className="row" key={f.key}>
                      <div className="label">{labelMap[f.key] || f.key}</div>
                      <div className="value" title={f.title}>
                        {safe(f.value)}
                      </div>
                    </div>
                  ))}
                </div>

                {data?.notes && (
                  <div className="section">
                    <div className="section-title">Notes</div>
                    <div className="notes">{String(data.notes)}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
