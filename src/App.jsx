import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  useLocation,
  Navigate,
} from "react-router-dom";
import Home from "./pages/Home";
import Products from "./pages/Products";
import Register from "./pages/Register";
import Login from "./pages/Login";
import "./App.css";
import Contact from "./pages/Contact";
import WhyUs from "./pages/WhyUs";
import { AuthProvider } from "./context/AuthContext";
import ProductDetails from "./pages/ProductDetails";
import Dashboard from "./dashBoard/DashBoard"; // Fixed import path casing
import DashboardLayout from "./layouts/DashboardLayout";
import AddProduct from "./pages/AddProduct";
import MyProducts from "./pages/MyProducts";
import MyOrders from "./pages/MyOrders";
import CustomerOrders from "./pages/CustomerOrders";
import MyReviews from "./pages/MyReviews";
import Cart from "./pages/Cart";
import ChatPage from "./pages/ChatPage";
import PrivateRoute from "./components/PrivateRoute";
import Marketplace from "./pages/Marketplace";
import Checkout from "./pages/Checkout";
import CodResult from "./pages/CodResult";
// Admin pages
import Users from "./pages/admin/Users";
import AdminOrders from "./pages/admin/AdminOrders";
import Payments from "./pages/admin/Payments";
import MarketPrice from "./pages/admin/MarketPrice";
import UserDetails from "./pages/admin/UserDetails";
import EditUser from "./pages/admin/EditUser";
import AdminReviews from "./pages/admin/AdminReviews";

const StartupRedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    // Skip if already on login or coming from a direct deep link that isn't root
    if (location.pathname !== "/" && location.pathname !== "/login") return;
    const token = localStorage.getItem("authToken");
    const exp = localStorage.getItem("expiration");
    const role = localStorage.getItem("role");
    const refreshToken = localStorage.getItem("refreshToken");
    let expired = false;
    if (exp) {
      const expTime = Date.parse(exp);
      if (!isNaN(expTime) && Date.now() >= expTime) expired = true;
    }
    if (!token || expired) {
      // If token expired but refresh token present, let AuthProvider's bootstrap handle refresh.
      // We just wait a tick; if still no valid token after short delay, stay on current page.
      setTimeout(() => {
        const newToken = localStorage.getItem("authToken");
        if (!newToken) return; // still not authenticated
        // proceed with redirect below
        const finalRole = localStorage.getItem("role");
        if (finalRole === "admin") navigate("/dashboard", { replace: true });
        else if (finalRole === "farmer" || finalRole === "seller")
          navigate("/dashboard", { replace: true });
        else if (finalRole === "buyer")
          navigate("/products", { replace: true });
      }, 800);
      return;
    }
    if (role) {
      if (role === "admin") navigate("/dashboard", { replace: true });
      else if (role === "farmer" || role === "seller")
        navigate("/dashboard", { replace: true });
      else if (role === "buyer") navigate("/products", { replace: true });
    }
  }, [location.pathname, navigate]);
  return null;
};
function App() {
  return (
    <AuthProvider>
      <Router>
        <StartupRedirect />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/why-us" element={<WhyUs />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/join" element={<Register />} />
          <Route path="/products/:productId" element={<ProductDetails />} />
          <Route path="/chat/:productId" element={<ChatPage />} />
          {/* Dashboard layout with nested routes keeps navbar mounted */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <DashboardLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<Dashboard embedded />} />
            <Route path="add-product" element={<AddProduct />} />
            <Route path="my-products" element={<MyProducts />} />
            <Route path="my-orders" element={<MyOrders />} />
            <Route path="my-reviews" element={<MyReviews />} />
            <Route path="customer-orders" element={<CustomerOrders />} />
            <Route path="cart" element={<Cart />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="checkout/cod-result" element={<CodResult />} />
            {/* Admin nested under dashboard as well */}
            {/* New Users route */}
            <Route path="users" element={<Users />} />
            <Route path="users/:userId/view" element={<UserDetails />} />
            <Route path="users/:userId/edit" element={<EditUser />} />
            {/* Back-compat redirects */}
            <Route
              path="admin/farmers"
              element={<Navigate to="/dashboard/users" replace />}
            />
            <Route
              path="admin/users"
              element={<Navigate to="/dashboard/users" replace />}
            />
            <Route
              path="admin/buyers"
              element={<Navigate to="/dashboard/users" replace />}
            />
            <Route path="admin/orders" element={<AdminOrders />} />
            <Route path="admin/payments" element={<Payments />} />
            <Route path="admin/reviews" element={<AdminReviews />} />
            <Route path="admin/market-price" element={<MarketPrice />} />
            <Route
              path="admin/blocked-accounts"
              element={<Navigate to="/dashboard/users" replace />}
            />
            <Route
              path="admin/locked-accounts"
              element={<Navigate to="/dashboard/users" replace />}
            />
          </Route>
          {/* Legacy absolute paths redirect to the nested dashboard routes */}
          <Route
            path="/add-product"
            element={<Navigate to="/dashboard/add-product" replace />}
          />
          <Route
            path="/my-products"
            element={<Navigate to="/dashboard/my-products" replace />}
          />
          <Route
            path="/my-orders"
            element={<Navigate to="/dashboard/my-orders" replace />}
          />
          <Route
            path="/customer-orders"
            element={<Navigate to="/dashboard/customer-orders" replace />}
          />
          {/* Legacy /marketplace path now redirects to public /products */}
          <Route
            path="/marketplace"
            element={<Navigate to="/products" replace />}
          />
          {/* Redirect old absolute paths to new nested dashboard routes */}
          <Route
            path="/cart"
            element={<Navigate to="/dashboard/cart" replace />}
          />
          <Route
            path="/checkout"
            element={<Navigate to="/dashboard/checkout" replace />}
          />
          <Route
            path="/admin/farmers"
            element={<Navigate to="/dashboard/users" replace />}
          />
          <Route
            path="/admin/buyers"
            element={<Navigate to="/dashboard/users" replace />}
          />
          <Route
            path="/admin/users"
            element={<Navigate to="/dashboard/users" replace />}
          />
          <Route
            path="/admin/orders"
            element={<Navigate to="/dashboard/admin/orders" replace />}
          />
          <Route
            path="/admin/payments"
            element={<Navigate to="/dashboard/admin/payments" replace />}
          />
          <Route
            path="/admin/reviews"
            element={<Navigate to="/dashboard/admin/reviews" replace />}
          />
          <Route
            path="/admin/market-price"
            element={<Navigate to="/dashboard/admin/market-price" replace />}
          />
          <Route
            path="/admin/blocked-accounts"
            element={<Navigate to="/dashboard/users" replace />}
          />
          <Route
            path="/admin/locked-accounts"
            element={<Navigate to="/dashboard/users" replace />}
          />
          {/* Fallback route for 404 Not Found */}
          <Route path="*" element={<div>Page Not Found</div>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
