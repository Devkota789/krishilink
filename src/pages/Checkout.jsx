import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api, { paymentAPI } from "../api/api";
import Navbar from "../components/Navbar";
import DashboardNavbar from "../components/DashboardNavbar";
import Footer from "../components/Footer";
import { useAuth } from "../context/AuthContext";
import "./Checkout.css";
import eSewaLogo from "../assets/Images/esewaLogo.jpg";
import eSewaLogoGreen from "../assets/Images/esewaLogoGreenBackground.jpg";
import codLogo from "../assets/Images/COD.png";
// Note: add a Khalti logo to assets if available, otherwise we'll render text

// Role-aware navbar component
const RoleAwareNavbar = () => {
  const { user } = useAuth();
  return user?.role === "farmer" ? <DashboardNavbar /> : <Navbar />;
};

const SHIPPING_FEE = 100; // per backend
const TAX_RATE = 0.01; // 1%

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [cartId, setCartId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [codLoading, setCodLoading] = useState(false);
  // Deprecated overlay state (kept temporarily for fallback UI)
  const [codHtml, setCodHtml] = useState("");
  const [showCodModal, setShowCodModal] = useState(false);
  const [imageBlobs, setImageBlobs] = useState({}); // productId -> blob URL
  const [productDetailsCache, setProductDetailsCache] = useState({}); // productId -> productImageCode
  // no form ref needed; we'll create and submit a throwaway form programmatically

  // Guard: if not logged in send to login (check both storages)
  useEffect(() => {
    const fromEither = (k) =>
      sessionStorage.getItem(k) ?? localStorage.getItem(k);
    const token = fromEither("authToken");
    const exp = fromEither("expiration");
    const refresh = localStorage.getItem("refreshToken");
    let valid = false;
    if (token) valid = true;
    else if (refresh) valid = true;
    if (!valid && exp) {
      const t = Date.parse(exp);
      if (!isNaN(t) && Date.now() < t) valid = true;
    }
    if (!valid) navigate("/login", { replace: true });
  }, [navigate]);

  // Load cart
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await api.get("/api/Cart/getMyCart");
        let cartItems = [];
        let cid = null;
        // try to determine cartId from response
        if (Array.isArray(resp.data?.data)) {
          const carts = resp.data.data;
          if (carts.length) {
            const c0 = carts[0] || {};
            cid = c0.cartId || c0.CartId || c0.id || c0.Id || c0.cartID || null;
          }
          carts.forEach(
            (c) => Array.isArray(c.items) && cartItems.push(...c.items)
          );
        } else if (resp.data?.data?.items) {
          const cd = resp.data.data;
          cid = cd.cartId || cd.CartId || cd.id || cd.Id || cd.cartID || null;
          cartItems = resp.data.data.items;
        } else if (Array.isArray(resp.data)) {
          cartItems = resp.data;
        }
        const normalized = cartItems.map((c) => ({
          productId: c.productId,
          quantity: Number(c.quantity || c.qty || 0),
          productName: c.productName || c.name || "Product",
          rate: Number(c.rate || c.price || 0),
          unit: c.unit || "kg",
          productImageCode: c.productImageCode || c.imageCode || null,
        }));
        setItems(normalized);
        // Stash cartId in state with reliable fallbacks
        const navCartId = location.state?.cartId;
        const chosen = String(
          navCartId ||
            cid ||
            window.__kl_cartId ||
            sessionStorage.getItem("kl_cartId") ||
            ""
        );
        setCartId(chosen);
        try {
          if (chosen) sessionStorage.setItem("kl_cartId", chosen);
          window.__kl_cartId = chosen;
        } catch {}
      } catch (e) {
        setError(e.message || "Failed to load cart");
      } finally {
        setLoading(false);
      }
    })();
  }, [location.state]);

  // Fetch product image code for items where missing
  useEffect(() => {
    const missing = items.filter(
      (it) => !it.productImageCode && !productDetailsCache[it.productId]
    );
    if (!missing.length) return;
    let cancelled = false;
    (async () => {
      try {
        const results = await Promise.all(
          missing.map(async (it) => {
            try {
              const resp = await api.get(
                `/api/Product/getProduct/${it.productId}`
              );
              const data = resp.data?.data || resp.data || {};
              const code =
                data.productImageCode ||
                data.imageCode ||
                data.productImageId ||
                null;
              return { productId: it.productId, code };
            } catch (err) {
              return { productId: it.productId, code: null };
            }
          })
        );
        if (cancelled) return;
        const mapCodes = {};
        results.forEach((r) => {
          if (r && r.code) mapCodes[r.productId] = r.code;
        });
        if (Object.keys(mapCodes).length) {
          setItems((prev) =>
            prev.map((it) =>
              mapCodes[it.productId]
                ? { ...it, productImageCode: mapCodes[it.productId] }
                : it
            )
          );
          setProductDetailsCache((prev) => ({ ...prev, ...mapCodes }));
        } else {
          const looked = {};
          results.forEach((r) => (looked[r.productId] = r.code || false));
          setProductDetailsCache((prev) => ({ ...prev, ...looked }));
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [items, productDetailsCache]);

  // Fetch images for items that have an image code and not yet loaded
  useEffect(() => {
    const abort = new AbortController();
    const loadImages = async () => {
      for (const it of items) {
        if (!it.productImageCode) continue;
        if (imageBlobs[it.productId]) continue;
        try {
          const resp = await api.get(
            `/api/Product/getProductImage/${it.productImageCode}`,
            { responseType: "blob", signal: abort.signal }
          );
          const url = URL.createObjectURL(resp.data);
          setImageBlobs((prev) => ({ ...prev, [it.productId]: url }));
        } catch {}
      }
    };
    if (items.length) loadImages();
    return () => abort.abort();
  }, [items, imageBlobs]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(imageBlobs).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imageBlobs]);

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + (i.rate || 0) * i.quantity, 0),
    [items]
  );
  const shipping = SHIPPING_FEE;
  const payable = subtotal + shipping; // subtotal + shipping
  // For UI, show 2dp; for API, compute with up to 4dp to mirror server's decimal math
  const taxDisplay = Number((TAX_RATE * payable).toFixed(2)); // UI only
  const totalDisplay = Number((payable + taxDisplay).toFixed(2)); // UI only
  const totalForApiNum = Number((payable + payable * TAX_RATE).toFixed(4)); // numeric for debug
  const totalForApiStr = (payable + payable * TAX_RATE).toFixed(4); // precise string for API

  const handleEsewaCheckout = async () => {
    try {
      setError(null);
      if (!items.length) {
        setError("Your cart is empty");
        return;
      }
      // Resolve cartId from state or fallbacks
      const cid =
        cartId ||
        window.__kl_cartId ||
        sessionStorage.getItem("kl_cartId") ||
        "";
      if (!cid) {
        setError(
          "Unable to determine cart ID. Please return to cart and try again."
        );
        return;
      }
      console.log("Initiating eSewa payment", {
        cartId: cid,
        totalForApi: totalForApiStr,
        subtotal,
        shipping,
        tax: Number((TAX_RATE * (subtotal + shipping)).toFixed(2)),
      });

      // Call backend to initiate payment
      const resp = await paymentAPI.initiatePayment(cid, totalForApiStr);
      const payload = resp.data;
      if (!payload || !payload.total_amount || !payload.signature) {
        throw new Error("Invalid payment response");
      }

      // Build and submit a form to eSewa
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "https://rc-epay.esewa.com.np/api/epay/main/v2/form";

      const addField = (name, value) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value ?? "";
        form.appendChild(input);
      };

      addField("amount", payload.amount);
      addField("tax_amount", payload.tax_amount);
      addField("total_amount", payload.total_amount);
      addField("transaction_uuid", payload.transaction_uuid);
      addField("product_code", payload.product_code);
      addField("product_service_charge", payload.product_service_charge ?? "0");
      addField(
        "product_delivery_charge",
        payload.product_delivery_charge ?? "0"
      );
      addField("success_url", payload.success_url);
      addField("failure_url", payload.failure_url);
      // IMPORTANT: include signed_field_names as required by eSewa to validate signature
      addField(
        "signed_field_names",
        payload.signed_field_names ||
          "total_amount,transaction_uuid,product_code"
      );
      addField("signature", payload.signature);

      document.body.appendChild(form);
      form.submit();
    } catch (e) {
      console.error("Failed to start eSewa payment", e);
      setError(e.message || "Failed to start eSewa payment");
    }
  };

  const handleKhaltiCheckout = async () => {
    try {
      setError(null);
      if (!items.length) {
        setError("Your cart is empty");
        return;
      }
      const cid =
        cartId ||
        window.__kl_cartId ||
        sessionStorage.getItem("kl_cartId") ||
        "";
      if (!cid) {
        setError(
          "Unable to determine cart ID. Please return to cart and try again."
        );
        return;
      }
      console.log("Initiating Khalti payment", {
        cartId: cid,
        totalForApi: totalForApiStr,
      });

      const resp = await paymentAPI.initiatePaymentForKhalti(
        cid,
        totalForApiStr
      );
      // Backend now returns the payment URL directly as plain text (ContentResult)
      // but we also support JSON shapes for flexibility.
      const data = resp.data;
      let redirectUrl = null;
      if (typeof data === "string") {
        redirectUrl = (data || "").trim();
      } else if (data && typeof data === "object") {
        redirectUrl = data.redirectUrl || data.payment_url || data.url || null;
      }
      if (redirectUrl && /^https?:\/\//i.test(redirectUrl)) {
        window.location.href = redirectUrl;
        return;
      }

      // Try form-post shape if provided
      if (data.formAction && (data.fields || data.formFields)) {
        const fields = data.fields || data.formFields;
        const form = document.createElement("form");
        form.method = "POST";
        form.action = data.formAction;
        Object.entries(fields).forEach(([name, value]) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = name;
          input.value = value ?? "";
          form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
        return;
      }

      // Fallback: if server returned a proper 200 but unknown shape
      throw new Error("Invalid Khalti initiation response");
    } catch (e) {
      console.error("Failed to start Khalti payment", e);
      setError(e.message || "Failed to start Khalti payment");
    }
  };

  const handleCashOnDelivery = async () => {
    try {
      setError(null);
      setCodLoading(true);
      if (!items.length) {
        setError("Your cart is empty");
        return;
      }
      const cid =
        cartId ||
        window.__kl_cartId ||
        sessionStorage.getItem("kl_cartId") ||
        "";
      if (!cid) {
        setError(
          "Unable to determine cart ID. Please return to cart and try again."
        );
        return;
      }

      // Use server-required double precision value (string) we computed
      const resp = await paymentAPI.cashOnDelivery(cid, totalForApiStr);
      const contentType =
        (resp &&
          resp.headers &&
          (resp.headers["content-type"] || resp.headers["Content-Type"])) ||
        "";
      const data = resp?.data;
      const isHtml =
        String(contentType).includes("text/html") ||
        (typeof data === "string" && /<\s*html[\s\S]*>/i.test(data));
      if (isHtml) {
        // Persist HTML to sessionStorage with a short-lived key and navigate to a dedicated page
        const htmlStr = typeof data === "string" ? data : String(data);
        const key = `codHtml:${Date.now()}`;
        try {
          sessionStorage.setItem(key, htmlStr);
        } catch {}
        navigate("/dashboard/checkout/cod-result", {
          replace: true,
          state: { htmlKey: key },
        });
        return;
      }
      // JSON path
      const success = data?.success !== undefined ? data.success : true;
      const message = data?.message || "Cash on Delivery order placed.";
      if (!success) {
        throw new Error(message || "Cash on Delivery failed");
      }
      navigate("/dashboard/my-orders", {
        replace: true,
        state: { toast: message },
      });
    } catch (e) {
      console.error("Cash on Delivery failed", e);
      setError(e.message || "Cash on Delivery failed");
    } finally {
      setCodLoading(false);
    }
  };

  return (
    <div className="checkout-page">
      <RoleAwareNavbar />
      <div className="checkout-container">
        <br />
        <br />
        <br />
        <div className="checkout-header">
          <button
            className="top-back-btn"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            ← Back
          </button>
          <h1>Checkout</h1>
        </div>
        {error && <div className="checkout-error">{error}</div>}
        {loading ? (
          <div className="checkout-loading">Loading checkout...</div>
        ) : !items.length ? (
          <div className="checkout-empty">Your cart is empty.</div>
        ) : (
          <div className="checkout-grid">
            <div className="checkout-items">
              {items.map((it) => {
                const imgSrc = imageBlobs[it.productId];
                const initials = it.productName
                  ?.split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase();
                return (
                  <div key={it.productId} className="checkout-item">
                    <div className="item-thumb">
                      {imgSrc ? (
                        <img src={imgSrc} alt={it.productName} />
                      ) : (
                        <span className="thumb-fallback">
                          {initials || "P"}
                        </span>
                      )}
                    </div>
                    <div className="item-name">{it.productName}</div>
                    <div className="item-qty">x {it.quantity}</div>
                    <div className="item-price">
                      ₹{(it.rate * it.quantity).toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="checkout-summary">
              <h2>Order Summary</h2>
              <div className="row">
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="row">
                <span>Shipping</span>
                <span>₹{shipping.toFixed(2)}</span>
              </div>
              <div className="row">
                <span>Tax (1%)</span>
                <span>₹{taxDisplay.toFixed(2)}</span>
              </div>
              <div className="row total">
                <span>Total</span>
                <span>₹{totalDisplay.toFixed(2)}</span>
              </div>
              <button className="esewa-btn" onClick={handleEsewaCheckout}>
                <span className="esewa-text">Proceed with</span>
                <img
                  src={eSewaLogo}
                  alt="eSewa"
                  className="esewa-icon esewa-icon--default"
                />
                <img
                  src={eSewaLogoGreen}
                  alt="eSewa"
                  className="esewa-icon esewa-icon--hover"
                />
              </button>
              <button className="khalti-btn" onClick={handleKhaltiCheckout}>
                <span className="khalti-text">Proceed with</span>
                <span className="khalti-badge">Khalti</span>
              </button>
              <button
                className="cod-btn"
                onClick={handleCashOnDelivery}
                disabled={codLoading}
                title="Pay with Cash on Delivery"
              >
                {codLoading ? (
                  <span>Placing COD order...</span>
                ) : (
                  <>
                    <span className="cod-text">Cash on Delivery</span>
                    <img
                      src={codLogo}
                      alt="Cash on Delivery"
                      className="cod-icon"
                    />
                  </>
                )}
              </button>
              {codHtml && (
                <button
                  className="back-btn"
                  style={{ marginTop: 8 }}
                  onClick={() => {
                    const key = `codHtml:${Date.now()}`;
                    try {
                      sessionStorage.setItem(key, codHtml);
                    } catch {}
                    navigate("/dashboard/checkout/cod-result", {
                      replace: true,
                      state: { htmlKey: key },
                    });
                  }}
                >
                  View COD Details
                </button>
              )}
              <button className="back-btn" onClick={() => navigate("/cart")}>
                Back to Cart
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Overlay flow deprecated: render nothing here; using route-based page instead */}
      <Footer />
    </div>
  );
}
