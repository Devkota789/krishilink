// Centralized storage helper to support session-only vs remembered sessions
// Remembered sessions use localStorage; non-remembered use sessionStorage.

const REMEMBER_KEY = "kl_remember";

export const setRemember = (remember) => {
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? "true" : "false");
  } catch {}
};

export const isRemember = () => {
  try {
    return localStorage.getItem(REMEMBER_KEY) === "true";
  } catch {
    return false;
  }
};

export const getStore = () => {
  try {
    return isRemember() ? localStorage : sessionStorage;
  } catch {
    // Fallback to localStorage
    return localStorage;
  }
};

export const storage = {
  getStore,
  get(key) {
    try {
      return getStore().getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      getStore().setItem(key, value);
    } catch {}
  },
  remove(key) {
    try {
      getStore().removeItem(key);
    } catch {}
  },
  // Remove auth-related keys from BOTH storages defensively
  clearAuthKeys() {
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
    try {
      keys.forEach((k) => {
        try {
          localStorage.removeItem(k);
        } catch {}
        try {
          sessionStorage.removeItem(k);
        } catch {}
      });
      // refreshToken only resides in localStorage for remembered sessions
      try {
        localStorage.removeItem("refreshToken");
      } catch {}
      // Session id for current tab
      try {
        sessionStorage.removeItem("krishilink_session_id");
      } catch {}
    } catch {}
  },
  getToken() {
    try {
      return getStore().getItem("authToken");
    } catch {
      return null;
    }
  },
  getExpiration() {
    try {
      return getStore().getItem("expiration");
    } catch {
      return null;
    }
  },
};

// Helper to peek a key from either storage (useful for diagnostics)
export const peekEither = (key) => {
  try {
    return sessionStorage.getItem(key) ?? localStorage.getItem(key);
  } catch {
    return null;
  }
};
