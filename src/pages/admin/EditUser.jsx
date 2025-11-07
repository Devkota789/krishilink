import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { userAPI } from "../../api/api";
import LocationPicker from "../../components/LocationPicker";
import "../../components/BulkOrderModal.css";

// Safe getter supporting multiple possible key casings from backend
const getField = (obj, keys, fallback = "") => {
  if (!obj) return fallback;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return fallback;
};

export default function EditUser() {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState([]);
  const [success, setSuccess] = useState("");
  const [initial, setInitial] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [file, setFile] = useState(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [location, setLocation] = useState({
    latitude: "",
    longitude: "",
    address: "",
  });

  const [form, setForm] = useState({
    FullName: "",
    Email: "",
    PhoneNumber: "",
    Latitude: "",
    Longitude: "",
    CurrentPassword: "",
    Password: "",
    ConfirmPassword: "",
  });

  // Load existing user details
  useEffect(() => {
    let revokeUrl = null;
    const run = async () => {
      setLoading(true);
      setError("");
      setSuccess("");
      try {
        const res = await userAPI.getUserDetailsById(userId);
        if (res?.success) {
          const data = res.data || {};
          setInitial(data);
          const FullName = getField(
            data,
            ["FullName", "fullName", "Name", "name"],
            ""
          );
          const Email = getField(data, ["Email", "email"], "");
          const PhoneNumber = getField(
            data,
            ["PhoneNumber", "phoneNumber", "Phone", "phone"],
            ""
          );
          const Latitude = getField(data, ["Latitude", "latitude"], "");
          const Longitude = getField(data, ["Longitude", "longitude"], "");
          setForm((f) => ({
            ...f,
            FullName: FullName ?? "",
            Email: Email ?? "",
            PhoneNumber: PhoneNumber ?? "",
            Latitude: Latitude ?? "",
            Longitude: Longitude ?? "",
          }));
          setLocation({
            latitude: Latitude ?? "",
            longitude: Longitude ?? "",
            address: getField(data, ["Address", "address"], ""),
          });

          // Image preview
          if (data.imageUrl) {
            setImageUrl(data.imageUrl);
          } else if (data.imageBase64) {
            setImageUrl(`data:image/png;base64,${data.imageBase64}`);
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

  const avatarInitial = useMemo(() => {
    const name = form.FullName || "?";
    return String(name).trim().charAt(0).toUpperCase() || "?";
  }, [form.FullName]);

  const onChange = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const onReset = () => {
    if (!initial) return;
    const FullName = getField(
      initial,
      ["FullName", "fullName", "Name", "name"],
      ""
    );
    const Email = getField(initial, ["Email", "email"], "");
    const PhoneNumber = getField(
      initial,
      ["PhoneNumber", "phoneNumber", "Phone", "phone"],
      ""
    );
    const Latitude = getField(initial, ["Latitude", "latitude"], "");
    const Longitude = getField(initial, ["Longitude", "longitude"], "");
    setForm({
      FullName: FullName ?? "",
      Email: Email ?? "",
      PhoneNumber: PhoneNumber ?? "",
      Latitude: Latitude ?? "",
      Longitude: Longitude ?? "",
      CurrentPassword: "",
      Password: "",
      ConfirmPassword: "",
    });
    setFile(null);
    setLocation({
      latitude: Latitude ?? "",
      longitude: Longitude ?? "",
      address: getField(initial, ["Address", "address"], ""),
    });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setErrorDetails([]);
    setSuccess("");

    // Basic client-side check if changing password
    if (form.Password || form.ConfirmPassword || form.CurrentPassword) {
      if (!form.CurrentPassword) {
        setError("Current password is required to change password.");
        return;
      }
      if (form.Password !== form.ConfirmPassword) {
        setError("Password and Confirm Password do not match.");
        return;
      }
    }

    try {
      setSubmitting(true);
      const fd = new FormData();
      // Append only provided fields to avoid overwriting with empty
      const appendIfPresent = (k, v) => {
        if (v !== undefined && v !== null && v !== "") fd.append(k, v);
      };
      appendIfPresent("FullName", form.FullName);
      if (file) fd.append("Image", file);
      appendIfPresent("Email", form.Email);
      appendIfPresent("PhoneNumber", form.PhoneNumber);
      appendIfPresent(
        "Latitude",
        form.Latitude === "" ? "" : String(form.Latitude)
      );
      appendIfPresent(
        "Longitude",
        form.Longitude === "" ? "" : String(form.Longitude)
      );
      appendIfPresent("CurrentPassword", form.CurrentPassword);
      appendIfPresent("Password", form.Password);
      appendIfPresent("ConfirmPassword", form.ConfirmPassword);

      const res = await userAPI.updateProfileById(userId, fd);
      if (res?.success) {
        setSuccess(res?.message || "Profile updated successfully.");
        // Optional: navigate to details after short delay
        setTimeout(() => navigate(`/dashboard/users/${userId}/view`), 800);
      } else {
        const detailsArr = Array.isArray(res?.errorDetails)
          ? res.errorDetails
          : res?.errors && typeof res.errors === "object"
          ? Object.values(res.errors).flat()
          : [];
        setErrorDetails(detailsArr);
        const details = detailsArr.join("; ");
        setError(res?.error || res?.message || details || "Update failed");
      }
    } catch (e) {
      setError(e?.message || "Update failed");
      setErrorDetails([]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      <Navbar />
      <main style={{ paddingTop: 90, flex: 1 }}>
        <div
          className="user-details-wrap"
          style={{ maxWidth: 900, margin: "0 auto" }}
        >
          <div className="user-details-card">
            <div className="details-header">
              <div className="avatar" style={{ width: 64, height: 64 }}>
                {imageUrl ? (
                  <img src={imageUrl} alt="user" />
                ) : (
                  <div className="avatar-fallback">{avatarInitial}</div>
                )}
              </div>
              <div className="head-text">
                <h1 className="title">Edit User</h1>
                <div className="sub">Update profile details and photo</div>
              </div>
              <div className="head-actions">
                <button className="btn" onClick={() => navigate(-1)}>
                  Back
                </button>
              </div>
            </div>

            {loading ? (
              <div className="loading">Loading user…</div>
            ) : error && !initial ? (
              <div className="error">{error}</div>
            ) : (
              <form onSubmit={onSubmit} className="details-body">
                {error && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    style={{
                      marginBottom: 12,
                      fontFamily:
                        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                      whiteSpace: "pre-wrap",
                      background: "#fff5f5",
                      color: "#b42318",
                      border: "1px dashed #b42318",
                      padding: 12,
                      borderRadius: 8,
                      textAlign: "center",
                    }}
                  >
                    {"--- Update Error ---"}
                    {"\n"}
                    {error}
                    {"\n-------------------"}
                  </div>
                )}
                {success && (
                  <div className="ok" style={{ marginBottom: 12 }}>
                    {success}
                  </div>
                )}

                <div className="grid">
                  <div className="row">
                    <div className="label">Full Name</div>
                    <div className="value">
                      <input
                        type="text"
                        className="input"
                        value={form.FullName}
                        onChange={(e) => onChange("FullName", e.target.value)}
                        placeholder="Full name"
                        required
                      />
                    </div>
                  </div>

                  <div className="row">
                    <div className="label">Email</div>
                    <div className="value">
                      <input
                        type="email"
                        className="input"
                        value={form.Email}
                        onChange={(e) => onChange("Email", e.target.value)}
                        placeholder="user@example.com"
                      />
                    </div>
                  </div>

                  <div className="row">
                    <div className="label">Phone Number</div>
                    <div className="value">
                      <input
                        type="tel"
                        className="input"
                        value={form.PhoneNumber}
                        onChange={(e) =>
                          onChange("PhoneNumber", e.target.value)
                        }
                        placeholder="98XXXXXXXX"
                      />
                    </div>
                  </div>

                  <div className="row">
                    <div className="label">Location</div>
                    <div className="value">
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          type="button"
                          className="btn"
                          onClick={() => setShowLocationModal(true)}
                        >
                          {form.Latitude && form.Longitude
                            ? "Change Location"
                            : "Select Location"}
                        </button>
                        <div
                          style={{
                            fontSize: 14,
                            color:
                              form.Latitude && form.Longitude
                                ? "#2d7a2d"
                                : "#999",
                          }}
                        >
                          {form.Latitude && form.Longitude
                            ? `Lat: ${form.Latitude}, Lng: ${form.Longitude}`
                            : "No location selected"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="row">
                    <div className="label">Profile Image</div>
                    <div className="value">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                      />
                      <div
                        style={{ fontSize: 12, color: "#666", marginTop: 6 }}
                      >
                        Leave empty to keep current image.
                      </div>
                    </div>
                  </div>

                  <div className="row">
                    <div className="label">Current Password</div>
                    <div className="value">
                      <input
                        type="password"
                        className="input"
                        value={form.CurrentPassword}
                        onChange={(e) =>
                          onChange("CurrentPassword", e.target.value)
                        }
                        placeholder="Only required if changing password"
                      />
                    </div>
                  </div>

                  <div className="row">
                    <div className="label">New Password</div>
                    <div className="value">
                      <input
                        type="password"
                        className="input"
                        value={form.Password}
                        onChange={(e) => onChange("Password", e.target.value)}
                        placeholder="New password"
                      />
                    </div>
                  </div>

                  <div className="row">
                    <div className="label">Confirm Password</div>
                    <div className="value">
                      <input
                        type="password"
                        className="input"
                        value={form.ConfirmPassword}
                        onChange={(e) =>
                          onChange("ConfirmPassword", e.target.value)
                        }
                        placeholder="Confirm new password"
                      />
                    </div>
                  </div>
                </div>

                <div
                  className="details-actions"
                  style={{ marginTop: 16, display: "flex", gap: 8 }}
                >
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => navigate(-1)}
                  >
                    Cancel
                  </button>
                  <button type="button" className="btn" onClick={onReset}>
                    Reset
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
      <Footer />

      {/* Location Picker Modal */}
      {showLocationModal && (
        <div
          className="bulk-order-modal-overlay"
          onClick={() => setShowLocationModal(false)}
        >
          <div
            className="bulk-order-modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 700 }}
          >
            <div
              className="bulk-order-modal-header"
              style={{ background: "#2d7a2d", color: "white" }}
            >
              <h2 style={{ fontSize: "1.1rem" }}>Select Location</h2>
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
                onLocationChange={(loc) => {
                  setLocation(loc);
                  setForm((f) => ({
                    ...f,
                    Latitude: loc.latitude,
                    Longitude: loc.longitude,
                  }));
                }}
              />
              <div style={{ textAlign: "right", marginTop: 12 }}>
                <button
                  type="button"
                  className="btn"
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
}
