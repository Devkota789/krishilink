import React from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import "./Contact.css";
import { FaEnvelope, FaPhone, FaUser, FaPaperPlane } from "react-icons/fa";
import { motion } from "framer-motion";

const Contact = () => {
  return (
    <div className="contact-page">
      <Navbar />
      <motion.div
        className="contact-container"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        <h1>
          <FaEnvelope
            style={{
              color: "#388e3c",
              marginRight: "0.5rem",
              verticalAlign: "middle",
            }}
          />
          Contact Us
        </h1>
        <p>Have questions or feedback? Reach out to us!</p>
        <form className="contact-form">
          <label>
            <FaUser
              style={{
                marginRight: "0.4rem",
                color: "#388e3c",
                verticalAlign: "middle",
              }}
            />
            Name:
            <input type="text" placeholder="Your Name" required />
          </label>
          <label>
            <FaEnvelope
              style={{
                marginRight: "0.4rem",
                color: "#388e3c",
                verticalAlign: "middle",
              }}
            />
            Email:
            <input type="email" placeholder="Your Email" required />
          </label>
          <label>
            Message:
            <textarea placeholder="Your Message" required />
          </label>
          <motion.button
            type="submit"
            className="send-btn"
            whileHover={{ scale: 1.07 }}
            whileTap={{ scale: 0.96 }}
          >
            <FaPaperPlane
              style={{ marginRight: "0.4rem", verticalAlign: "middle" }}
            />
            Send Message
          </motion.button>
        </form>
        <div className="contact-info">
          <p>
            <FaEnvelope
              style={{
                marginRight: "0.4rem",
                color: "#388e3c",
                verticalAlign: "middle",
              }}
            />
            Email: krishilinknepal@gmail.com
          </p>
          <p>
            <FaPhone
              style={{
                marginRight: "0.4rem",
                color: "#388e3c",
                verticalAlign: "middle",
              }}
            />
            Phone: +977-9816607597
          </p>
        </div>
      </motion.div>
      <Footer />
    </div>
  );
};

export default Contact;
