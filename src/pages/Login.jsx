import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import "./Login.css";

// Precompiled regex patterns to avoid recreation per render
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9]{10}$/;

const Login = () => {
  const navigate = useNavigate();
  const { login, sendOTP, verifyOTP } = useAuth();
  const [activeTab, setActiveTab] = useState("otp");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [validationErrors, setValidationErrors] = useState({});
  const messageTimerRef = useRef(null);

  // Password Login State
  const [passwordLogin, setPasswordLogin] = useState({
    emailOrPhone: "",
    password: "",
  });
  const [rememberMe, setRememberMe] = useState(false);

  // OTP Login State
  const [otpLogin, setOtpLogin] = useState({
    emailOrPhone: "",
    otp: "",
  });
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);

  // Clear message after 5 seconds (single timer instance)
  useEffect(() => {
    if (message.text) {
      if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
      messageTimerRef.current = setTimeout(() => {
        setMessage({ text: "", type: "" });
      }, 5000);
    }
    return () => {
      if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    };
  }, [message.text]);

  // OTP Timer countdown (fix: add interval delay to prevent rapid rerenders)
  useEffect(() => {
    if (!otpSent || otpTimer <= 0) return;
    const intervalId = setInterval(() => {
      setOtpTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(intervalId);
  }, [otpSent, otpTimer]);

  const validateEmail = useCallback((email) => EMAIL_REGEX.test(email), []);
  const validatePhone = useCallback((phone) => PHONE_REGEX.test(phone), []);
  const validateInput = useCallback(
    (value) => {
      if (!value) return "This field is required";
      if (value.includes("@")) {
        if (!validateEmail(value)) return "Please enter a valid email address";
      } else if (!validatePhone(value)) {
        return "Please enter a valid 10-digit phone number";
      }
      return "";
    },
    [validateEmail, validatePhone]
  );

  const handlePasswordLoginChange = (e) => {
    const { name, value } = e.target;
    setPasswordLogin((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear validation error when user types
    setValidationErrors((prev) => ({
      ...prev,
      [name]: "",
    }));
  };

  const handleOtpLoginChange = (e) => {
    const { name, value } = e.target;
    setOtpLogin((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear validation error when user types
    setValidationErrors((prev) => ({
      ...prev,
      [name]: "",
    }));
  };

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: "", type: "" });

    // Validate inputs
    const emailOrPhoneError = validateInput(passwordLogin.emailOrPhone);
    const passwordError = !passwordLogin.password ? "Password is required" : "";

    if (emailOrPhoneError || passwordError) {
      setValidationErrors({
        emailOrPhone: emailOrPhoneError,
        password: passwordError,
      });
      setLoading(false);
      return;
    }

    try {
      const result = await login({
        emailOrPhone: passwordLogin.emailOrPhone,
        password: passwordLogin.password,
        rememberMe,
      });

      if (result.success) {
        setMessage({
          text: "Login successful! Redirecting...",
          type: "success",
        });
        if (rememberMe) {
          try {
            localStorage.setItem(
              "kl_last_login_identifier",
              passwordLogin.emailOrPhone
            );
          } catch {}
        } else {
          localStorage.removeItem("kl_last_login_identifier");
        }
        // Instant role-based redirect (avoid waiting for other bootstrap logic)
        const role = localStorage.getItem("role");
        const target =
          role === "buyer"
            ? "/products"
            : role === "admin" || role === "farmer" || role === "seller"
            ? "/dashboard"
            : "/dashboard"; // default fallback
        navigate(target, { replace: true });
      } else {
        setMessage({ text: result.error || "Login failed", type: "error" });
      }
    } catch (error) {
      console.error("Login error:", error);
      setMessage({
        text: "Network error or server is not responding. Please try again later.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: "", type: "" });

    // Validate input
    const emailOrPhoneError = validateInput(otpLogin.emailOrPhone);
    if (emailOrPhoneError) {
      setValidationErrors({ emailOrPhone: emailOrPhoneError });
      setLoading(false);
      return;
    }

    try {
      const result = await sendOTP(otpLogin.emailOrPhone);

      if (result.success) {
        const isEmail = otpLogin.emailOrPhone.includes("@");
        setMessage({
          text: `OTP sent successfully! Please check your ${
            isEmail ? "email" : "phone"
          }.`,
          type: "success",
        });
        setOtpSent(true);
        setOtpTimer(600); // 10 minutes in seconds
      } else {
        setMessage({
          text: result.error || "Failed to send OTP",
          type: "error",
        });
      }
    } catch (error) {
      console.error("OTP sending error:", error);
      setMessage({
        text: "Network error or server is not responding. Please try again later.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOtpLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: "", type: "" });

    if (!otpLogin.otp || otpLogin.otp.length !== 6) {
      setValidationErrors({ otp: "Please enter a valid 6-digit OTP" });
      setLoading(false);
      return;
    }

    try {
      const result = await verifyOTP(
        otpLogin.emailOrPhone,
        otpLogin.otp,
        rememberMe
      );
      console.log("OTP verify result:", result);
      console.log("User in localStorage:", localStorage.getItem("user"));
      console.log(
        "Auth token in localStorage:",
        localStorage.getItem("authToken")
      );

      if (result.success) {
        setMessage({
          text: "Login successful! Redirecting...",
          type: "success",
        });
        if (rememberMe) {
          try {
            localStorage.setItem(
              "kl_last_login_identifier",
              otpLogin.emailOrPhone
            );
          } catch {}
        } else {
          localStorage.removeItem("kl_last_login_identifier");
        }
        const role = localStorage.getItem("role");
        const target =
          role === "buyer"
            ? "/products"
            : role === "admin" || role === "farmer" || role === "seller"
            ? "/dashboard"
            : "/dashboard";
        navigate(target, { replace: true });
      } else {
        // Show all error details if present
        let errorMsg = result.error || "Invalid OTP";
        if (
          Array.isArray(result.errorDetails) &&
          result.errorDetails.length > 0
        ) {
          errorMsg += "\n" + result.errorDetails.join("\n");
        }
        setMessage({ text: errorMsg, type: "error" });
        if (
          typeof result.error === "string" &&
          result.error.toLowerCase().includes("expired")
        ) {
          setOtpSent(false);
          setOtpTimer(0);
        }
      }
    } catch (error) {
      console.error("OTP verification error:", error);
      setMessage({
        text: "Network error or server is not responding. Please try again later.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="login-page">
      <Navbar />
      <div className="login-container">
        <h1>Welcome Back</h1>
        <div className="login-form-container">
          <div className="login-tabs">
            <button
              className={`tab ${activeTab === "otp" ? "active" : ""}`}
              onClick={() => setActiveTab("otp")}
            >
              Login with OTP
            </button>
            <button
              className={`tab ${activeTab === "password" ? "active" : ""}`}
              onClick={() => setActiveTab("password")}
            >
              Login with Password
            </button>
          </div>

          {activeTab === "password" ? (
            <form onSubmit={handlePasswordLogin} className="login-form">
              <div className="form-group">
                <label htmlFor="emailOrPhone">Email or Phone Number</label>
                <input
                  type="text"
                  id="emailOrPhone"
                  name="emailOrPhone"
                  value={passwordLogin.emailOrPhone}
                  onChange={handlePasswordLoginChange}
                  placeholder="Enter your email or phone number"
                  required
                  className={validationErrors.emailOrPhone ? "error" : ""}
                />
                {validationErrors.emailOrPhone && (
                  <span className="error-message">
                    {validationErrors.emailOrPhone}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={passwordLogin.password}
                  onChange={handlePasswordLoginChange}
                  required
                  placeholder="Enter your password"
                  className={validationErrors.password ? "error" : ""}
                />
                {validationErrors.password && (
                  <span className="error-message">
                    {validationErrors.password}
                  </span>
                )}
              </div>
              <div className="login-extra-row">
                <label className="remember-me">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Remember me</span>
                </label>
              </div>

              <div className="forgot-password-link">
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="link-btn"
                >
                  Forgot password?
                </button>
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
                className="submit-button"
                disabled={loading}
              >
                {loading ? "Logging in..." : "Login"}
              </button>
            </form>
          ) : (
            <form
              onSubmit={otpSent ? handleOtpLogin : handleSendOtp}
              className="login-form"
            >
              <div className="form-group">
                <label htmlFor="otpEmailOrPhone">Email or Phone Number</label>
                <input
                  type="text"
                  id="otpEmailOrPhone"
                  name="emailOrPhone"
                  value={otpLogin.emailOrPhone}
                  onChange={handleOtpLoginChange}
                  placeholder="Enter your email or phone number"
                  disabled={otpSent}
                  required
                  className={validationErrors.emailOrPhone ? "error" : ""}
                />
                {validationErrors.emailOrPhone && (
                  <span className="error-message">
                    {validationErrors.emailOrPhone}
                  </span>
                )}
              </div>

              {otpSent && (
                <>
                  <div className="form-group">
                    <label htmlFor="otp">OTP</label>
                    <input
                      type="text"
                      id="otp"
                      name="otp"
                      value={otpLogin.otp}
                      onChange={handleOtpLoginChange}
                      required
                      placeholder="Enter OTP"
                      maxLength="6"
                      className={validationErrors.otp ? "error" : ""}
                    />
                    {validationErrors.otp && (
                      <span className="error-message">
                        {validationErrors.otp}
                      </span>
                    )}
                  </div>
                  {otpTimer > 0 && (
                    <div className="otp-timer">
                      OTP expires in: {formatTime(otpTimer)}
                    </div>
                  )}
                </>
              )}

              <div className="login-extra-row">
                <label className="remember-me">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Remember me</span>
                </label>
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
                className="submit-button"
                disabled={loading || (otpSent && otpTimer === 0)}
              >
                {loading
                  ? otpSent
                    ? "Verifying..."
                    : "Sending OTP..."
                  : otpSent
                  ? "Verify OTP"
                  : "Send OTP"}
              </button>

              {otpSent && (
                <button
                  type="button"
                  className="resend-button"
                  onClick={() => {
                    setOtpSent(false);
                    setOtpTimer(0);
                    setOtpLogin({
                      emailOrPhone: otpLogin.emailOrPhone,
                      otp: "",
                    });
                    setValidationErrors({});
                    setMessage({ text: "", type: "" });
                  }}
                  disabled={loading}
                >
                  Change Email/Phone
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
