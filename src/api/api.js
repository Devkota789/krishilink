import axios from "axios";
import { handleApiResponse } from "./handleApiResponse";

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://w1vqqn7ucvzpndp9xsvdkd15gzcedswvilahs3agd6b3dljo7tg24pbklk4u.shamir.com.np";

// Create axios instance with base URL
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    Accept: "application/json",
  },
  maxRedirects: 0, // Do not follow redirects
});

// Track the current session token to detect changes
let currentSessionToken = null;

// Simple helpers to read from storages
function getFromEither(key) {
  try {
    return sessionStorage.getItem(key) ?? localStorage.getItem(key);
  } catch {
    return localStorage.getItem(key);
  }
}
// Prefer localStorage when a refreshToken exists (remembered sessions),
// otherwise prefer sessionStorage. This prevents stale session tokens from
// overshadowing freshly refreshed tokens that are written to localStorage.
function getPreferred(key) {
  try {
    const hasRefresh = !!localStorage.getItem("refreshToken");
    if (hasRefresh) {
      // Remembered session: use localStorage values
      return localStorage.getItem(key) ?? sessionStorage.getItem(key);
    }
    // Session-only: use sessionStorage first
    return sessionStorage.getItem(key) ?? localStorage.getItem(key);
  } catch {
    return localStorage.getItem(key);
  }
}
function removeAuthShadows() {
  // Clear potentially stale auth values in the opposite store to avoid shadowing
  try {
    sessionStorage.removeItem("authToken");
  } catch {}
  try {
    sessionStorage.removeItem("expiration");
  } catch {}
}
function setInSession(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {}
}
function setInLocal(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}
function removeFromBoth(key) {
  try {
    sessionStorage.removeItem(key);
  } catch {}
  try {
    localStorage.removeItem(key);
  } catch {}
}

// Add request interceptor to add auth token and proactively refresh if near expiry
api.interceptors.request.use(
  async (config) => {
    try {
      const url = config.url || "";
      const isRefreshCall = url.includes("/api/KrishilinkAuth/refreshToken");
      const EXPIRY_SKEW_MS = 60 * 1000; // 1 minute skew

      // Pre-flight refresh if token is expired/near expiry and we have a refresh token
      if (!isRefreshCall) {
        const expStr = getPreferred("expiration");
        const refreshToken = localStorage.getItem("refreshToken"); // refreshToken lives in localStorage only for remembered sessions
        if (expStr && refreshToken) {
          const expTime = Date.parse(expStr);
          if (
            !Number.isNaN(expTime) &&
            Date.now() + EXPIRY_SKEW_MS >= expTime
          ) {
            console.log(
              "Request interceptor - Access token near/at expiry, attempting refresh"
            );
            try {
              if (isRefreshing) {
                // Wait for the in-flight refresh to complete
                await new Promise((resolve, reject) => {
                  refreshQueue.push({ resolve, reject });
                });
              } else {
                isRefreshing = true;
                const newToken = await performRefresh();
                processRefreshQueue(null, newToken);
              }
            } catch (e) {
              processRefreshQueue(e, null);
              console.error("Pre-flight refresh failed", e);
              // Allow the request to proceed; the response interceptor will handle logout/redirect
            } finally {
              isRefreshing = false;
            }
          }
        }
      }

      const token = getPreferred("authToken");

      // Debug logging to help identify auth issues
      console.log("Request interceptor - URL:", config.url);
      console.log("Request interceptor - Token exists:", !!token);
      if (token) {
        console.log(
          "Request interceptor - Token preview:",
          token.substring(0, 20) + "..."
        );
      }

      if (token && !isRefreshCall) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
        console.log("Request interceptor - Authorization header set");
      } else if (!token) {
        console.log(
          "Request interceptor - No token found, request will be sent without auth"
        );
      }

      return config;
    } catch (error) {
      console.error("Request interceptor error:", error);
      return Promise.reject(error);
    }
  },
  (error) => {
    console.error("Request interceptor error:", error);
    return Promise.reject(error);
  }
);

// --- Refresh token handling ---
let isRefreshing = false;
let refreshQueue = []; // {resolve, reject}

const processRefreshQueue = (error, newToken) => {
  refreshQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(newToken);
  });
  refreshQueue = [];
};

const performRefresh = async () => {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) throw new Error("No refresh token available");
  const formData = new FormData();
  formData.append("refreshToken", refreshToken);
  // Use a bare axios call to avoid interceptor recursion
  const resp = await axios.post(
    BASE_URL + "/api/KrishilinkAuth/refreshToken",
    formData,
    { headers: { Accept: "application/json" } }
  );
  const raw = resp.data;
  const data = raw?.data || raw;
  if (!data || !data.token) throw new Error("Invalid refresh response");
  // Persist basics. Refresh is only possible in remembered mode (refreshToken in localStorage),
  // so write refreshed values to localStorage.
  setInLocal("authToken", data.token);
  if (data.expiration) setInLocal("expiration", data.expiration);
  if (data.role) setInLocal("role", data.role);
  if (data.id !== undefined) setInLocal("userId", String(data.id));
  if (data.fullName) setInLocal("fullName", data.fullName);
  if (data.refreshToken) setInLocal("refreshToken", data.refreshToken);
  // Ensure any stale sessionStorage auth values don't overshadow the refreshed token
  removeAuthShadows();
  try {
    // Keep for compatibility if other parts read it; stored in localStorage
    localStorage.setItem("user", JSON.stringify(data));
  } catch {}
  currentSessionToken = data.token;
  // Notify app (AuthContext listens)
  try {
    window.dispatchEvent(
      new CustomEvent("auth:token-refreshed", {
        detail: {
          token: data.token,
          expiration: data.expiration,
          user: data,
        },
      })
    );
  } catch (e) {
    console.warn("Dispatch token-refreshed failed", e);
  }
  return data.token;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const originalRequest = error.config || {};
    const url = originalRequest.url || "";
    const isRefreshCall = url.includes("/api/KrishilinkAuth/refreshToken");

    // If network/server error 502
    if (status === 502) {
      console.error(
        "Server error (502): The server is temporarily unavailable"
      );
      return Promise.reject(
        new Error("Server is temporarily unavailable. Please try again later.")
      );
    }

    // Handle 401 / 301 / 302 with refresh attempt first (301/302 from auth redirect)
    if (
      (status === 401 || status === 403 || status === 301 || status === 302) &&
      !originalRequest._retry &&
      !isRefreshCall
    ) {
      const refreshToken = localStorage.getItem("refreshToken");
      if (refreshToken) {
        originalRequest._retry = true;
        try {
          if (isRefreshing) {
            // Queue until refresh completes
            const newToken = await new Promise((resolve, reject) => {
              refreshQueue.push({ resolve, reject });
            });
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers["Authorization"] = "Bearer " + newToken;
            return api(originalRequest);
          }
          isRefreshing = true;
          const newToken = await performRefresh();
          processRefreshQueue(null, newToken);
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers["Authorization"] = "Bearer " + newToken;
          return api(originalRequest);
        } catch (refreshErr) {
          processRefreshQueue(refreshErr, null);
          console.error("Refresh attempt failed", refreshErr);
          // Fall through to logout logic
        } finally {
          isRefreshing = false;
        }
      }

      // No refresh token or refresh failed: clear & redirect
      removeFromBoth("authToken");
      removeFromBoth("expiration");
      removeFromBoth("role");
      removeFromBoth("userId");
      removeFromBoth("fullName");
      try {
        localStorage.removeItem("refreshToken");
      } catch {}
      try {
        localStorage.removeItem("user");
      } catch {}
      try {
        sessionStorage.removeItem("krishilink_session_id");
      } catch {}
      currentSessionToken = null;
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
      return Promise.reject(
        new Error("Session expired. Redirecting to login.")
      );
    }

    return Promise.reject(error);
  }
);

// Auth API endpoints
export const authAPI = {
  registerUser: async (userData) => {
    try {
      const response = await api.post(
        "/api/KrishilinkAuth/registerUser",
        userData
      );
      return handleApiResponse(response);
    } catch (err) {
      if (err.response && err.response.data) {
        return handleApiResponse(err.response);
      }
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
  sendConfirmationEmail: (emailData) =>
    api.post("/api/KrishilinkAuth/sendConfirmationEmail", emailData),
  confirmEmail: (token) =>
    api.get(`/api/KrishilinkAuth/ConfirmEmail?token=${token}`),
  passwordLogin: async (credentials) => {
    try {
      const response = await api.post(
        "/api/KrishilinkAuth/passwordLogin",
        credentials
      );
      return handleApiResponse(response);
    } catch (err) {
      if (err.response && err.response.data) {
        return handleApiResponse(err.response);
      }
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
  sendOTP: (otpData) => api.post("/api/KrishilinkAuth/sendOTP", otpData),
  verifyOTP: async (otpData) => {
    try {
      const response = await api.post("/api/KrishilinkAuth/verifyOTP", otpData);
      return handleApiResponse(response);
    } catch (err) {
      if (err.response && err.response.data) {
        return handleApiResponse(err.response);
      }
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
  refreshToken: (refreshToken) => {
    // Use bare axios to avoid interceptors and Authorization header on refresh call
    const formData = new FormData();
    formData.append("refreshToken", refreshToken);
    return axios.post(BASE_URL + "/api/KrishilinkAuth/refreshToken", formData, {
      headers: { Accept: "application/json" },
    });
  },
  logout: (logoutData) => api.post("/api/KrishilinkAuth/logout", logoutData),
  // Add token invalidation endpoint if your API supports it
  invalidateToken: (token) =>
    api.post("/api/KrishilinkAuth/invalidateToken", { token }),
};

// Wrapper for login to handle ApiResponse<T> and ApiError<T>
export async function login({ emailOrPhone, password }) {
  try {
    const response = await authAPI.passwordLogin({ emailOrPhone, password });
    const data = response.data;

    if (data.success) {
      // Success: ApiResponse<T>
      return { success: true, data: data.data, message: data.message };
    } else {
      // ApiResponse<T> with success: false
      let errorMsg = data.message || "Login failed";
      let errorDetails = [];
      if (Array.isArray(data.errors)) {
        errorDetails = data.errors;
      } else if (data.errors && typeof data.errors === "object") {
        errorDetails = Object.values(data.errors).flat();
      }
      return { success: false, error: errorMsg, errorDetails };
    }
  } catch (err) {
    // Axios error: check for ApiError<T> shape
    if (err.response && err.response.data) {
      const data = err.response.data;
      let errorMsg = data.message || data.title || "Login failed";
      let errorDetails = [];
      if (Array.isArray(data.errors)) {
        errorDetails = data.errors;
      } else if (data.errors && typeof data.errors === "object") {
        errorDetails = Object.values(data.errors).flat();
      }
      return { success: false, error: errorMsg, errorDetails };
    }
    // Network or unknown error
    return { success: false, error: "Network error", errorDetails: [] };
  }
}

// Product API endpoints
export const productAPI = {
  getAllProducts: async () => {
    try {
      const response = await api.get("/api/Product/getProducts");
      return handleApiResponse(response);
    } catch (err) {
      if (err.response && err.response.data) {
        return handleApiResponse(err.response);
      }
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
  getNearProducts: async (latitude, longitude) => {
    try {
      const response = await api.get(
        `/api/Product/getNearProducts/${latitude},${longitude}`
      );
      return handleApiResponse(response);
    } catch (err) {
      if (err.response && err.response.data) {
        return handleApiResponse(err.response);
      }
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
  getProductById: (productId) =>
    api.get(`/api/Product/getProduct/${productId}`),
  getRelatedProducts: (productId) =>
    api.get(`/api/Product/getRelatedProducts/${productId}`),
  getProductImage: (productImageCode) =>
    api.get(`/api/Product/getProductImage/${productImageCode}`, {
      responseType: "blob",
    }),
  addProduct: async (productData, config = {}) => {
    try {
      const response = await api.post(
        "/api/Product/addProduct",
        productData,
        config
      );
      return handleApiResponse(response);
    } catch (err) {
      if (err.response && err.response.data) {
        return handleApiResponse(err.response);
      }
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
  getMyProducts: async () => {
    try {
      const response = await api.get("/api/Product/getMyProducts");
      return handleApiResponse(response);
    } catch (err) {
      if (err.response && err.response.data) {
        return handleApiResponse(err.response);
      }
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
  getMyProduct: (productId) =>
    api.get(`/api/Product/getMyProduct/${productId}`),
  updateProduct: (productId, productData) =>
    api.put(`/api/Product/updateProduct/${productId}`, productData),
  updateProductStatus: (productId) =>
    api.put(`/api/Product/updateProductStatus/${productId}`),
  deleteProduct: (productId) =>
    api.delete(`/api/Product/deleteProduct/${productId}`),
};

// Order API endpoints
export const orderAPI = {
  // Admin: list all orders across the platform
  getAllOrders: async () => {
    try {
      const response = await api.get("/api/Order/getAllOrders");
      return handleApiResponse(response);
    } catch (err) {
      if (err.response && err.response.data) {
        return handleApiResponse(err.response);
      }
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
  addOrder: (orderData) => {
    // For multipart/form-data, let the browser set the Content-Type header with boundary
    const config = {
      headers: {
        // Remove the default Accept header for this request
        Accept: undefined,
      },
    };
    return api.post("/api/Order/addOrder", orderData, config);
  },
  addOrders: (ordersData) => {
    // For bulk orders using application/json
    const config = {
      headers: {
        "Content-Type": "application/json",
      },
    };
    return api.post("/api/Order/addOrders", ordersData, config);
  },
  getMyOrders: () => api.get("/api/Order/getMyOrders"),
  // Farmer's customers' orders
  getCustomerOrders: async () => {
    try {
      return await api.get("/api/Order/getCustomerOrders");
    } catch (err) {
      // Allow callers to interpret 404 as empty list
      throw err;
    }
  },
  // Buyer-specific orders endpoint (returns 404 if none)
  getBuyerOrders: async () => {
    try {
      return await api.get("/api/Order/getBuyerOrders");
    } catch (err) {
      // Pass through so caller can interpret 404 as no orders
      throw err;
    }
  },
  getOrderById: (orderId) => api.get(`/api/Order/getOrder/${orderId}`),
  updateOrderStatus: (orderId, statusData) =>
    api.put(`/api/Order/updateOrderStatus/${orderId}`, statusData),
  deleteOrder: (orderId) => api.delete(`/api/Order/deleteOrder/${orderId}`),
  // New API functions for order item status updates
  cancelOrderItem: async (orderId, orderItemId) => {
    try {
      const response = await api.put(
        `/api/Order/cancelOrderItem/${orderId}/${orderItemId}`
      );
      // Normalize ApiResponse<T> if backend wraps
      if (
        response?.data &&
        typeof response.data === "object" &&
        Object.prototype.hasOwnProperty.call(response.data, "success")
      ) {
        return handleApiResponse(response);
      }
      return { success: true, data: response.data };
    } catch (err) {
      if (err.response && err.response.data) {
        return handleApiResponse(err.response);
      }
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
  confirmOrderItem: async (orderItemId) => {
    try {
      const response = await api.put(
        `/api/Order/confirmOrderItem/${orderItemId}`
      );
      if (
        response?.data &&
        typeof response.data === "object" &&
        Object.prototype.hasOwnProperty.call(response.data, "success")
      ) {
        return handleApiResponse(response);
      }
      return { success: true, data: response.data };
    } catch (err) {
      if (err.response && err.response.data) {
        return handleApiResponse(err.response);
      }
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
  shipOrderItem: async (orderItemId) => {
    try {
      const response = await api.put(`/api/Order/shipOrderItem/${orderItemId}`);
      if (
        response?.data &&
        typeof response.data === "object" &&
        Object.prototype.hasOwnProperty.call(response.data, "success")
      ) {
        return handleApiResponse(response);
      }
      return { success: true, data: response.data };
    } catch (err) {
      if (err.response && err.response.data) {
        return handleApiResponse(err.response);
      }
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
  deliverOrderItem: async (orderItemId) => {
    try {
      const response = await api.put(
        `/api/Order/deliverOrderItem/${orderItemId}`
      );
      if (
        response?.data &&
        typeof response.data === "object" &&
        Object.prototype.hasOwnProperty.call(response.data, "success")
      ) {
        return handleApiResponse(response);
      }
      return { success: true, data: response.data };
    } catch (err) {
      if (err.response && err.response.data) {
        return handleApiResponse(err.response);
      }
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
  markAsDelivery: async (orderItemId) => {
    try {
      const response = await api.put(
        `/api/Order/markAsDelivery/${orderItemId}`
      );
      if (
        response?.data &&
        typeof response.data === "object" &&
        Object.prototype.hasOwnProperty.call(response.data, "success")
      ) {
        return handleApiResponse(response);
      }
      return { success: true, data: response.data };
    } catch (err) {
      if (err.response && err.response.data) {
        return handleApiResponse(err.response);
      }
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
};

// Review API endpoints
export const reviewAPI = {
  addReview: (reviewData) => api.post("/api/Review/AddReview", reviewData),
  getProductReviews: (productId) =>
    api.get(`/api/Review/getProductReviews/${productId}`),
  deleteReview: (reviewId) =>
    api.delete(`/api/Review/DeleteReview/${reviewId}`),
  getMyReviews: () => api.get("/api/Review/getMyReviews"),
  updateReview: (reviewId, reviewData) =>
    api.put(`/api/Review/UpdateReview/${reviewId}`, reviewData),
  // Admin: get all reviews across the platform
  getAllReviews: async () => {
    try {
      const response = await api.get("/api/Review/GetAllReviews");
      // Normalize ApiResponse<T> shape if backend wraps
      if (
        typeof response.data === "object" &&
        response.data &&
        Object.prototype.hasOwnProperty.call(response.data, "success")
      ) {
        return handleApiResponse(response);
      }
      return { success: true, data: response.data };
    } catch (err) {
      if (err.response && err.response.data) {
        return handleApiResponse(err.response);
      }
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
};

// User API endpoints
export const userAPI = {
  // Admin: get all farmers
  getAllFarmers: async () => {
    try {
      const response = await api.get("/api/User/GetAllFarmers");
      // Some backends wrap in ApiResponse<T>; normalize here
      if (
        typeof response.data === "object" &&
        response.data &&
        Object.prototype.hasOwnProperty.call(response.data, "success")
      ) {
        return handleApiResponse(response);
      }
      return { success: true, data: response.data };
    } catch (err) {
      if (err.response && err.response.data) {
        return handleApiResponse(err.response);
      }
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
  // Buyer: get farmer details for a given product
  getFarmerDetailsByProductId: async (productId) => {
    try {
      const response = await api.get(`/api/User/getFarmerDetails/${productId}`);
      // Normalize ApiResponse<T> shape if backend wraps
      if (
        typeof response.data === "object" &&
        response.data &&
        Object.prototype.hasOwnProperty.call(response.data, "success")
      ) {
        return handleApiResponse(response);
      }
      return { success: true, data: response.data };
    } catch (err) {
      if (err.response && err.response.data) {
        return handleApiResponse(err.response);
      }
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
  // Admin: get all blocked users
  getAllBlockedUsers: async () => {
    try {
      const response = await api.get("/api/User/GetAllBlockedUsers");
      if (
        typeof response.data === "object" &&
        response.data &&
        Object.prototype.hasOwnProperty.call(response.data, "success")
      ) {
        return handleApiResponse(response);
      }
      return { success: true, data: response.data };
    } catch (err) {
      if (err.response && err.response.data) {
        return handleApiResponse(err.response);
      }
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
  // Admin: get all locked users
  getAllLockedUsers: async () => {
    try {
      const response = await api.get("/api/User/GetAllLockedUsers");
      if (
        typeof response.data === "object" &&
        response.data &&
        Object.prototype.hasOwnProperty.call(response.data, "success")
      ) {
        return handleApiResponse(response);
      }
      return { success: true, data: response.data };
    } catch (err) {
      if (err.response && err.response.data) {
        return handleApiResponse(err.response);
      }
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
  // Admin: user access controls
  lockUser: async (userId, lockOutEndTime) => {
    try {
      const form = new FormData();
      // Backend expects integer; we coerce to string safely
      const val =
        typeof lockOutEndTime === "number"
          ? String(Math.trunc(lockOutEndTime))
          : String(lockOutEndTime ?? 0);
      form.append("lockOutEndTime", val);
      const response = await api.put(`/api/User/lockUser/${userId}`, form, {
        headers: { Accept: "application/json" },
      });
      const data = response.data;
      if (
        data &&
        typeof data === "object" &&
        Object.prototype.hasOwnProperty.call(data, "success")
      ) {
        return handleApiResponse(response);
      }
      return { success: true, data };
    } catch (err) {
      if (err.response && err.response.data) {
        return handleApiResponse(err.response);
      }
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
  unlockUser: async (userId) => {
    try {
      const response = await api.put(`/api/User/unlockUser/${userId}`);
      const data = response.data;
      if (
        data &&
        typeof data === "object" &&
        Object.prototype.hasOwnProperty.call(data, "success")
      ) {
        return handleApiResponse(response);
      }
      return { success: true, data };
    } catch (err) {
      if (err.response && err.response.data) {
        return handleApiResponse(err.response);
      }
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
  blockUser: async (userId) => {
    try {
      const response = await api.put(`/api/User/blockUser/${userId}`);
      const data = response.data;
      if (
        data &&
        typeof data === "object" &&
        Object.prototype.hasOwnProperty.call(data, "success")
      ) {
        return handleApiResponse(response);
      }
      return { success: true, data };
    } catch (err) {
      if (err.response && err.response.data) {
        return handleApiResponse(err.response);
      }
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
  unblockUser: async (userId) => {
    try {
      const response = await api.put(`/api/User/unblockUser/${userId}`);
      const data = response.data;
      if (
        data &&
        typeof data === "object" &&
        Object.prototype.hasOwnProperty.call(data, "success")
      ) {
        return handleApiResponse(response);
      }
      return { success: true, data };
    } catch (err) {
      if (err.response && err.response.data) {
        return handleApiResponse(err.response);
      }
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
  resetPasswordByAdmin: async (userId, password, confirmPassword) => {
    try {
      const form = new FormData();
      form.append("password", password ?? "");
      form.append("confirmPassword", confirmPassword ?? "");
      const response = await api.put(
        `/api/User/resetPasswordByAdmin/${userId}`,
        form,
        { headers: { Accept: "application/json" } }
      );
      const data = response.data;
      if (
        data &&
        typeof data === "object" &&
        Object.prototype.hasOwnProperty.call(data, "success")
      ) {
        return handleApiResponse(response);
      }
      return { success: true, data };
    } catch (err) {
      if (err.response && err.response.data) {
        return handleApiResponse(err.response);
      }
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
  // Admin: get all buyers
  getAllBuyers: async () => {
    try {
      const response = await api.get("/api/User/GetAllBuyers");
      if (
        typeof response.data === "object" &&
        response.data &&
        Object.prototype.hasOwnProperty.call(response.data, "success")
      ) {
        return handleApiResponse(response);
      }
      return { success: true, data: response.data };
    } catch (err) {
      if (err.response && err.response.data) {
        return handleApiResponse(err.response);
      }
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
  // Admin: get all active users
  getAllActiveUsers: async () => {
    try {
      const response = await api.get("/api/User/GetAllActiveUsers");
      if (
        typeof response.data === "object" &&
        response.data &&
        Object.prototype.hasOwnProperty.call(response.data, "success")
      ) {
        return handleApiResponse(response);
      }
      return { success: true, data: response.data };
    } catch (err) {
      if (err.response && err.response.data) {
        return handleApiResponse(err.response);
      }
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
  // Admin: get all users (any role)
  getAllUsers: async () => {
    try {
      const response = await api.get("/api/User/GetAllUsers");
      if (
        typeof response.data === "object" &&
        response.data &&
        Object.prototype.hasOwnProperty.call(response.data, "success")
      ) {
        return handleApiResponse(response);
      }
      return { success: true, data: response.data };
    } catch (err) {
      if (err.response && err.response.data) {
        return handleApiResponse(err.response);
      }
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
  getMyDetails: () => api.get("/api/User/GetMyDetails"),
  getUserImage: () =>
    api.get("/api/User/getUserImage", { responseType: "blob" }),
  updateProfile: (profileData) =>
    api.put("/api/User/UpdateProfile", profileData),
  // Admin: update any user's profile by ID (multipart/form-data)
  updateProfileById: async (userId, formData) => {
    try {
      const response = await api.put(
        `/api/User/UpdateProfile/${userId}`,
        formData,
        {
          // Let the browser set Content-Type with boundary automatically
          headers: { Accept: "application/json" },
        }
      );
      return handleApiResponse(response);
    } catch (err) {
      if (err.response && err.response.data) {
        return handleApiResponse(err.response);
      }
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
  // New signature expects boolean path param: /api/User/updateStatus/{status}
  updateStatus: (isActive) => api.put(`/api/User/updateStatus/${!!isActive}`),
  deleteUser: (userId) => api.delete(`/api/User/Delete/${userId}`),
  // Lookup helpers
  getUserNameById: (userId) => api.get(`/api/User/getUserNameById/${userId}`),
  getUserImageById: (userId) =>
    api.get(`/api/User/getUserImageById/${userId}`, { responseType: "blob" }),
  // Detailed profile by ID
  getUserDetailsById: async (userId) => {
    try {
      const response = await api.get(`/api/User/GetUserDetailsById`, {
        params: { userId },
      });
      if (
        typeof response.data === "object" &&
        response.data &&
        Object.prototype.hasOwnProperty.call(response.data, "success")
      ) {
        return handleApiResponse(response);
      }
      return { success: true, data: response.data };
    } catch (err) {
      if (err.response && err.response.data) {
        return handleApiResponse(err.response);
      }
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
};

// Notification API endpoints
export const notificationAPI = {
  getNotifications: async (userId) => {
    try {
      // API described as POST /api/Notification/GetNotifications with userId as query param
      const response = await api.post(
        `/api/Notification/GetNotifications?userId=${encodeURIComponent(
          userId
        )}`
      );
      return handleApiResponse(response);
    } catch (err) {
      if (err.response && err.response.data) {
        return handleApiResponse(err.response);
      }
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
  markAsRead: async (notificationId) => {
    try {
      const response = await api.put(
        `/api/Notification/MarkAsRead/${notificationId}`
      );
      return handleApiResponse(response);
    } catch (err) {
      if (err.response && err.response.data)
        return handleApiResponse(err.response);
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
  deleteNotification: async (notificationId) => {
    try {
      const response = await api.delete(
        `/api/Notification/DeleteNotification/${notificationId}`
      );
      return handleApiResponse(response);
    } catch (err) {
      if (err.response && err.response.data)
        return handleApiResponse(err.response);
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
  clearAll: async () => {
    try {
      const response = await api.delete(
        `/api/Notification/ClearAllNotifications`
      );
      return handleApiResponse(response);
    } catch (err) {
      if (err.response && err.response.data)
        return handleApiResponse(err.response);
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
};

// Chat API endpoints
export const chatAPI = {
  getFarmerIdByProductId: (productId) =>
    api.get(`/api/Chat/getFarmerIdByProductId/${productId}`),
  getChatHistory: (user2Id) => api.get(`/api/Chat/getChatHistory/${user2Id}`),
  // The hub SendMessage method is used via SignalR; this wrapper is for fallback HTTP send if needed
  sendMessageHttp: (receiverUserId, message) =>
    api.post(`/api/Chat/sendMessage`, { receiverUserId, message }),
};

// Cart API endpoints
export const cartAPI = {
  getMyCart: async () => {
    try {
      const response = await api.get("/api/Cart/getMyCart");
      // Some backends may return 204 for empty cart
      if (response.status === 204 || response.data == null) {
        return { success: true, data: [] };
      }
      // Normalize via handleApiResponse if backend uses ApiResponse<T>
      if (
        typeof response.data === "object" &&
        response.data &&
        "success" in response.data
      ) {
        return handleApiResponse(response);
      }
      // Otherwise, pass through array/object
      return { success: true, data: response.data };
    } catch (err) {
      // Treat 404 as empty cart
      if (err?.response?.status === 404) {
        return { success: true, data: [] };
      }
      if (err.response && err.response.data) {
        return handleApiResponse(err.response);
      }
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
};

// Payment API endpoints
export const paymentAPI = {
  initiatePayment: async (cartId, totalPayableAmount) => {
    // Prefer x-www-form-urlencoded for simple [FromForm] binding on ASP.NET Core
    const form = new URLSearchParams();
    if (cartId == null || cartId === undefined) cartId = "";
    const amountStr =
      typeof totalPayableAmount === "number"
        ? String(totalPayableAmount)
        : totalPayableAmount ?? "";
    form.append("cartId", String(cartId));
    form.append("totalPayableAmount", amountStr);
    const config = {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
    };
    return api.post("/api/Payment/initiatePaymentForEsewa", form, config);
  },
  initiatePaymentForKhalti: async (cartId, totalPayableAmount) => {
    // ASP.NET Core [FromForm] expects form-encoded fields
    const form = new URLSearchParams();
    if (cartId == null || cartId === undefined) cartId = "";
    const amountStr =
      typeof totalPayableAmount === "number"
        ? String(totalPayableAmount)
        : totalPayableAmount ?? "";
    form.append("cartId", String(cartId));
    form.append("totalPayableAmount", amountStr);
    const config = {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
    };
    return api.post("/api/Payment/initiatePaymentForKhalti", form, config);
  },
  cashOnDelivery: async (cartId, totalPayableAmount) => {
    // Endpoint expects multipart/form-data with: cartId (string), totalPayableAmount (double)
    const formData = new FormData();
    const amountStr =
      typeof totalPayableAmount === "number"
        ? String(totalPayableAmount)
        : totalPayableAmount ?? "";
    formData.append("cartId", cartId != null ? String(cartId) : "");
    formData.append("totalPayableAmount", amountStr);
    // Let the browser set Content-Type with boundary; Accept HTML or JSON
    const config = {
      headers: { Accept: "text/html,application/json;q=0.9,*/*;q=0.8" },
    };
    return api.post("/api/Payment/cashOnDelivery", formData, config);
  },
  // Admin: list all payments
  getAllPayments: async () => {
    try {
      const response = await api.get("/api/Payment/getAllPayments");
      return handleApiResponse(response);
    } catch (err) {
      if (err.response && err.response.data) {
        return handleApiResponse(err.response);
      }
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
  // Admin: attempt refund for a specific order item (generic endpoint)
  // NOTE: Endpoint name may differ on your backend. Adjust if needed.
  refundOrderItem: async (orderItemId) => {
    try {
      const response = await api.put(
        `/api/Payment/refundOrderItem/${orderItemId}`
      );
      return handleApiResponse(response);
    } catch (err) {
      if (err.response && err.response.data) {
        return handleApiResponse(err.response);
      }
      return { success: false, error: "Network error", errorDetails: [] };
    }
  },
};

// Utility function to clear all authentication data
export const clearAuthData = () => {
  [
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
  ].forEach((k) => removeFromBoth(k));
  try {
    localStorage.removeItem("refreshToken");
  } catch {}
  try {
    sessionStorage.removeItem("krishilink_session_id");
  } catch {}
  currentSessionToken = null;
  console.log("All authentication data cleared via utility function");
};

// Utility function to check authentication status
export const checkAuthStatus = () => {
  const user = localStorage.getItem("user");
  const token = getFromEither("authToken");
  const refreshToken = localStorage.getItem("refreshToken");
  const sessionId = sessionStorage.getItem("krishilink_session_id");

  console.log("=== Authentication Status Check ===");
  console.log("User exists:", !!user);
  console.log("Token exists:", !!token);
  console.log("Refresh token exists:", !!refreshToken);
  console.log("Session ID exists:", !!sessionId);

  if (user) {
    try {
      const userData = JSON.parse(user);
      console.log("User role:", userData.role);
      console.log("User email/phone:", userData.emailOrPhone || userData.email);
    } catch (e) {
      console.log("Failed to parse user data");
    }
  }

  if (token) {
    console.log("Token preview:", token.substring(0, 20) + "...");
  }

  return {
    user: !!user,
    token: !!token,
    refreshToken: !!refreshToken,
    sessionId: !!sessionId,
  };
};

export default api;
