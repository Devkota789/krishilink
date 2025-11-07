import React from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { FaSeedling, FaShoppingBasket, FaUserPlus } from "react-icons/fa";
import { motion } from "framer-motion";
import Lottie from "lottie-react";
import farmerAnim from "../assets/animations/farmer.json";
import farmerCartFallback from "../assets/animations/farmer-cart-placeholder.json";
import "./Home.css";

const Home = () => {
  return (
    <div className="home">
      <Navbar />
      <motion.div
        className="hero-section"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <div className="page-bg-anim" aria-hidden="true">
          <Lottie
            className="page-faint-anim"
            animationData={
              farmerAnim && Object.keys(farmerAnim).length > 0
                ? farmerAnim
                : farmerCartFallback
            }
            loop
            autoplay
          />
        </div>
        <div className="hero-anim-block simple">
          <motion.h1
            className="hero-heading-text"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
          >
            <FaSeedling
              style={{
                color: "#2e7d32",
                marginRight: "0.5rem",
                verticalAlign: "middle",
              }}
            />
            Welcome to Krishilink
          </motion.h1>
          <motion.p
            className="hero-sub"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 0.7 }}
          >
            <FaShoppingBasket
              style={{
                color: "#43a047",
                marginRight: "0.4rem",
                verticalAlign: "middle",
              }}
            />
            Connecting Farmers with Quality Products
          </motion.p>
          <div className="cta-buttons">
            <motion.div
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Link to="/products" className="cta-button discover">
                <FaShoppingBasket
                  style={{ marginRight: "0.4rem", verticalAlign: "middle" }}
                />
                Discover Products
              </Link>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Link to="/join" className="cta-button join">
                <FaUserPlus
                  style={{ marginRight: "0.4rem", verticalAlign: "middle" }}
                />
                Join Krishilink
              </Link>
            </motion.div>
          </div>
        </div>
      </motion.div>
      <Footer />
    </div>
  );
};

export default Home;
