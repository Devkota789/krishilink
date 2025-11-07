import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import { authAPI, userAPI } from "../api/api";

// Backend base (duplicated from api.js for sendBeacon during unload)
const BACKEND_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
  "https://w1vqqn7ucvzpndp9xsvdkd15gzcedswvilahs3agd6b3dljo7tg24pbklk4u.shamir.com.np";

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

// Generate a unique device ID that changes on each session
const generateDeviceId = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const sessionId = Math.random().toString(36).substring(2, 15);
  return `web-${timestamp}-${random}-${sessionId}`;
};

// Get or create a session ID that persists only for the current browser session
const getSessionId = () => {
  let sessionId = sessionStorage.getItem("krishilink_session_id");
  if (!sessionId) {
    sessionId = Math.random().toString(36).substring(2, 15) + Date.now();
    sessionStorage.setItem("krishilink_session_id", sessionId);
  }
  return sessionId;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("user");
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState(null);
  const refreshTimerRef = useRef(null);
  const EXPIRY_SKEW_MS = 60 * 1000; // refresh 1 minute before expiry

  // Local wrapper referencing global helper (assigned later) or direct call
  const forceActiveStatus = () => {
    try {
      if (
        typeof window !== "undefined" &&
        typeof window.forceActiveStatus === "function"
      ) {
        window.forceActiveStatus();
      } else if (localStorage.getItem("authToken")) {
        userAPI.updateStatus(true).catch(() => {});
      }
    } catch {}
  };

  // Helper to persist ALL returned API fields individually (as requested)
  const persistAuthFields = (data, { remember = false } = {}) => {
    if (!data || typeof data !== "object") return;
    try {
      const setIn = remember ? localStorage : sessionStorage;
      if (data.token) setIn.setItem("authToken", data.token);
      if (remember && data.refreshToken)
        localStorage.setItem("refreshToken", data.refreshToken);
      if (data.role) setIn.setItem("role", data.role);
      if (data.expiration) setIn.setItem("expiration", data.expiration);
      if (data.id !== undefined && data.id !== null)
        setIn.setItem("userId", String(data.id));
      if (data.fullName) setIn.setItem("fullName", data.fullName);
      if (data.phoneNumber) setIn.setItem("phoneNumber", data.phoneNumber);
      if (data.email) setIn.setItem("email", data.email);
      if (data.address) setIn.setItem("address", data.address);
      if (data.latitude !== undefined)
        setIn.setItem("latitude", String(data.latitude));
      if (data.longitude !== undefined)
        setIn.setItem("longitude", String(data.longitude));
      // Clean up legacy user blob
      localStorage.removeItem("user");
      setIn.setItem("loginTimestamp", new Date().toISOString());
    } catch (e) {
      console.error("Failed to persist auth fields:", e);
    }
  };

  // Storage helpers with precedence: if localStorage has refreshToken, prefer localStorage for auth values
  const getPreferred = (key) => {
    try {
      const hasRefresh = !!localStorage.getItem("refreshToken");
      if (hasRefresh)
        return localStorage.getItem(key) ?? sessionStorage.getItem(key);
      return sessionStorage.getItem(key) ?? localStorage.getItem(key);
    } catch {
      return localStorage.getItem(key);
    }
  };
  const clearSessionAuthShadows = () => {
    try {
      sessionStorage.removeItem("authToken");
    } catch {}
    try {
      sessionStorage.removeItem("expiration");
    } catch {}
  };

  useEffect(() => {
    const bootstrap = async () => {
      const token = getPreferred("authToken");
      const savedUserStr = localStorage.getItem("user"); // legacy key (now unused)
      if (savedUserStr) localStorage.removeItem("user");

      // Reconstruct minimal user object from individually stored fields
      if (!user && token) {
        const fromEither = (k) =>
          sessionStorage.getItem(k) ?? localStorage.getItem(k);
        const reconstructed = {
          id: fromEither("userId") || null,
          role: fromEither("role") || null,
          fullName: fromEither("fullName") || null,
          phoneNumber: fromEither("phoneNumber") || null,
          email: fromEither("email") || null,
          address: fromEither("address") || null,
          latitude: fromEither("latitude")
            ? Number(fromEither("latitude"))
            : null,
          longitude: fromEither("longitude")
            ? Number(fromEither("longitude"))
            : null,
        };
        // Only set if at least an id or role exists
        if (reconstructed.id || reconstructed.role) setUser(reconstructed);
      }
      if (token) setSessionToken(token);

      // Expiration check
      const expStr = getPreferred("expiration");
      const refreshToken = localStorage.getItem("refreshToken");
      let needsRefresh = false;
      if (expStr) {
        const expTime = Date.parse(expStr);
        if (!isNaN(expTime) && Date.now() + EXPIRY_SKEW_MS >= expTime) {
          needsRefresh = true;
        }
      }
      if (!token && refreshToken) needsRefresh = true;
      if (needsRefresh && refreshToken) {
        await refreshSession();
      }
      scheduleRefresh();
      // If we have a token (remembered session), mark user active
      if (token) {
        forceActiveStatus();
        // Retry a couple times in case first attempt races network
        let attempts = 0;
        const retry = () => {
          attempts += 1;
          if (attempts > 3) return;
          setTimeout(() => {
            // Only retry if still logged in and last attempt maybe failed (no marker)
            if (localStorage.getItem("authToken")) {
              try {
                userAPI.updateStatus(true).catch(() => {});
              } catch {}
            }
          }, attempts * 1000);
        };
        retry(); // schedule first retry (1s)
        retry(); // second (2s)
        retry(); // third (3s)
      }
      setLoading(false);
    };
    bootstrap();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for external refresh events (from axios interceptor)
  useEffect(() => {
    const handler = (e) => {
      const detail = e.detail || {};
      if (detail.token) {
        setSessionToken(detail.token);
        if (detail.user) setUser(detail.user);
        if (detail.expiration)
          localStorage.setItem("expiration", detail.expiration);
        scheduleRefresh();
      }
    };
    window.addEventListener("auth:token-refreshed", handler);
    return () => window.removeEventListener("auth:token-refreshed", handler);
  }, []);

  const scheduleRefresh = () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const expStr = getPreferred("expiration");
    if (!expStr) return;
    const expTime = Date.parse(expStr);
    if (isNaN(expTime)) return;
    const now = Date.now();
    const msUntil = expTime - now - EXPIRY_SKEW_MS;
    if (msUntil <= 0) {
      refreshSession();
      return;
    }
    refreshTimerRef.current = setTimeout(() => {
      refreshSession();
    }, msUntil);
  };

  const login = async (credentials) => {
    // Clear any existing tokens from both storages to avoid shadowing
    try {
      sessionStorage.removeItem("authToken");
    } catch {}
    try {
      sessionStorage.removeItem("expiration");
    } catch {}
    try {
      localStorage.removeItem("authToken");
    } catch {}
    try {
      localStorage.removeItem("expiration");
    } catch {}
    try {
      localStorage.removeItem("refreshToken");
    } catch {}
    setSessionToken(null);

    const formData = new FormData();
    formData.append("EmailorPhone", credentials.emailOrPhone);
    formData.append("Password", credentials.password);
    // Always send a constant DeviceId per requirement
    formData.append("DeviceId", "string");

    const result = await authAPI.passwordLogin(formData);
    if (result.success && result.data && result.data.token) {
      const newToken = result.data.token;
      setUser(result.data);
      setSessionToken(newToken);
      persistAuthFields(result.data, { remember: !!credentials.rememberMe });
      // Mark user active on successful login
      try {
        userAPI.updateStatus(true).catch(() => {});
      } catch {}
      return { success: true };
    }
    return {
      success: false,
      error: result.error,
      errorDetails: result.errorDetails,
    };
  };

  const register = async (userData) => {
    const result = await authAPI.registerUser(userData);
    return result.success
      ? { success: true, data: result.data }
      : {
          success: false,
          error: result.error,
          errorDetails: result.errorDetails,
        };
  };

  const logout = async () => {
    try {
      // Mark user inactive before clearing tokens
      try {
        await userAPI.updateStatus(false);
      } catch (e) {
        console.warn("Failed to update status to inactive on logout", e);
      }
      const refreshToken = localStorage.getItem("refreshToken");
      const currentToken =
        sessionStorage.getItem("authToken") ??
        localStorage.getItem("authToken");
      if (refreshToken) {
        await authAPI.logout(refreshToken);
        console.log("Logout request sent to server");
      }
      if (currentToken) {
        try {
          console.log("Current token invalidated locally");
        } catch (e) {
          console.log("Token invalidation failed:", e);
        }
      }
    } catch (e) {
      console.error("Logout error:", e);
    } finally {
      setUser(null);
      setSessionToken(null);
      const keys = [
        "user",
        "authToken",
        "role",
        "expiration",
        "userId",
        "fullName",
        "phoneNumber",
        "email",
        "address",
        "latitude",
        "longitude",
        "loginTimestamp",
      ];
      keys.forEach((k) => {
        try {
          sessionStorage.removeItem(k);
        } catch {}
        try {
          localStorage.removeItem(k);
        } catch {}
      });
      try {
        localStorage.removeItem("refreshToken");
      } catch {}
      try {
        sessionStorage.removeItem("krishilink_session_id");
      } catch {}
      console.log("All authentication data cleared");
    }
  };

  const sendOTP = async (emailOrPhone) => {
    try {
      const formData = new FormData();
      formData.append("EmailorPhone", emailOrPhone);
      // Always send a constant DeviceId per requirement
      formData.append("DeviceId", "string");
      console.log("OTP request with device ID");
      const response = await authAPI.sendOTP(formData);
      return { success: true, message: response.data };
    } catch (error) {
      console.error("Send OTP failed:", error);
      return {
        success: false,
        error:
          error.response?.data?.message ||
          error.response?.data ||
          "Failed to send OTP",
      };
    }
  };

  const verifyOTP = async (emailOrPhone, otp, rememberMe = false) => {
    try {
      // Clear tokens from both storages before OTP login to avoid shadowing
      try {
        sessionStorage.removeItem("authToken");
      } catch {}
      try {
        sessionStorage.removeItem("expiration");
      } catch {}
      try {
        localStorage.removeItem("authToken");
      } catch {}
      try {
        localStorage.removeItem("expiration");
      } catch {}
      try {
        localStorage.removeItem("refreshToken");
      } catch {}
      setSessionToken(null);
      const formData = new FormData();
      formData.append("EmailorPhone", emailOrPhone);
      formData.append("otp", otp);
      const result = await authAPI.verifyOTP(formData);
      console.log("verifyOTP result:", result);
      if (result.success && result.data && result.data.token) {
        const newToken = result.data.token;
        setUser(result.data);
        setSessionToken(newToken);
        persistAuthFields(result.data, { remember: !!rememberMe });
        try {
          userAPI.updateStatus(true).catch(() => {});
        } catch {}
        return { success: true };
      }
      if (result && (result.error || result.errorDetails)) {
        console.log("verifyOTP error:", result.error, result.errorDetails);
      } else {
        console.log("verifyOTP unknown error, raw result:", result);
      }
      return {
        success: false,
        error: result.error,
        errorDetails: result.errorDetails,
      };
    } catch (error) {
      console.error("OTP verification failed:", error);
      if (error.response) {
        console.log("OTP verification error.response:", error.response);
        console.log(
          "OTP verification error.response.data:",
          error.response.data
        );
      }
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.title ||
        (error.response?.data?.errors
          ? Object.values(error.response.data.errors).flat().join(" ")
          : "") ||
        "OTP verification failed";
      return { success: false, error: errorMessage };
    }
  };

  const isTokenValid = () => {
    const token = getPreferred("authToken");
    return token && token === sessionToken;
  };

  const refreshSession = async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    if (refreshToken) {
      try {
        const response = await authAPI.refreshToken(refreshToken);
        const raw = response.data; // raw server response
        const data = raw?.data || raw; // handle wrapped or direct
        if (data && data.token) {
          setSessionToken(data.token);
          // Persist full structure if fields exist
          // For refreshes, treat presence of existing refresh token as remember preference
          const hadRefresh = !!localStorage.getItem("refreshToken");
          persistAuthFields(data, { remember: hadRefresh });
          // Avoid shadowing by removing stale session values
          clearSessionAuthShadows();
          // Update in-memory user if provided
          setUser(data);
          console.log("Token refreshed:", data.token.substring(0, 20) + "...");
          scheduleRefresh();
          return true;
        }
      } catch (error) {
        console.error("Token refresh failed:", error);
        logout();
        return false;
      }
    }
    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        register,
        sendOTP,
        verifyOTP,
        loading,
        isTokenValid,
        refreshSession,
        sessionToken,
        scheduleRefresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Robust active/inactive tracking for remembered sessions & tab lifecycle
// Triggers when: tab hidden, pagehide/unload, tab refocused/visible.
if (typeof window !== "undefined") {
  if (!window.__KL_STATUS_ACTIVITY_BOUND__) {
    window.__KL_STATUS_ACTIVITY_BOUND__ = true;

    const ENDPOINT_BASE = `${BACKEND_BASE}/api/User/updateStatus`;
    let lastState = null; // true = active, false = inactive
    let inflight = false;

    const sendStatus = (isActive) => {
      try {
        const token = (function () {
          try {
            // Prefer localStorage when refresh token exists
            return (
              (localStorage.getItem("refreshToken")
                ? localStorage.getItem("authToken")
                : sessionStorage.getItem("authToken")) ||
              localStorage.getItem("authToken")
            );
          } catch {
            return localStorage.getItem("authToken");
          }
        })();
        if (!token) return; // not logged in
        if (lastState === isActive) return; // no change
        lastState = isActive;
        inflight = true;
        fetch(`${ENDPOINT_BASE}/${isActive}`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
          keepalive: true,
        })
          .catch(() => {})
          .finally(() => {
            inflight = false;
          });
      } catch {}
    };

    // Expose a force function globally for bootstrap use
    window.forceActiveStatus = function forceActiveStatus() {
      try {
        const token = (function () {
          try {
            return (
              (localStorage.getItem("refreshToken")
                ? localStorage.getItem("authToken")
                : sessionStorage.getItem("authToken")) ||
              localStorage.getItem("authToken")
            );
          } catch {
            return localStorage.getItem("authToken");
          }
        })();
        if (!token) return;
        // Reset lastState to ensure call is sent even if previous session ended active
        lastState = null;
        // Use both axios API (if available) and fallback fetch to maximize success
        try {
          userAPI.updateStatus(true).catch(() => {});
        } catch {}
        fetch(`${ENDPOINT_BASE}/true`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
          keepalive: true,
        }).catch(() => {});
        lastState = true;
      } catch {}
    };

    // Helper reference inside module scope too
    const forceActiveStatus = window.forceActiveStatus;

    // Visible -> active; Hidden -> inactive
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        // If buyer chat is open, keep user active (don't mark inactive on simple hide/minimize)
        if (window.__BUYER_CHAT_OPEN__) return;
        sendStatus(false);
      } else if (document.visibilityState === "visible") {
        // Delay a tick to avoid rapid toggles
        setTimeout(() => sendStatus(true), 50);
      }
    });

    // Explicit focus/blur (covers some cases where visibility doesn't fire promptly)
    window.addEventListener("focus", () => sendStatus(true));
    window.addEventListener("blur", () => {
      // Don't instantly mark inactive on simple blur unless tab hidden soon after; small delay
      setTimeout(() => {
        if (
          document.visibilityState === "hidden" &&
          !window.__BUYER_CHAT_OPEN__
        )
          sendStatus(false);
      }, 300);
    });

    // Page being discarded / closed
    window.addEventListener("pagehide", () => sendStatus(false));
    window.addEventListener("beforeunload", () => sendStatus(false));

    // If page loads and already visible with a stored token, mark active (bootstrap may also do this)
    if (
      document.visibilityState === "visible" &&
      (() => {
        try {
          return (
            (localStorage.getItem("refreshToken")
              ? localStorage.getItem("authToken")
              : sessionStorage.getItem("authToken")) ||
            localStorage.getItem("authToken")
          );
        } catch {
          return localStorage.getItem("authToken");
        }
      })()
    ) {
      setTimeout(() => sendStatus(true), 0);
    }

    // Also on full load event (some browsers delay visibility change on restore)
    window.addEventListener("load", () => {
      const token = (function () {
        try {
          return (
            (localStorage.getItem("refreshToken")
              ? localStorage.getItem("authToken")
              : sessionStorage.getItem("authToken")) ||
            localStorage.getItem("authToken")
          );
        } catch {
          return localStorage.getItem("authToken");
        }
      })();
      if (token) {
        forceActiveStatus();
      }
    });
  }
}

export default AuthProvider;
