import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { FaTractor, FaCheckCircle, FaHandsHelping, FaRegEye } from 'react-icons/fa';
import { motion } from 'framer-motion';
import './WhyUs.css';

const features = [
  {
    icon: <FaTractor className="feature-icon" />,
    title: 'Direct from Farmers',
    desc: 'We eliminate middlemen, so you get fresh products and farmers get better prices.',
  },
  {
    icon: <FaCheckCircle className="feature-icon" />,
    title: 'Quality Assurance',
    desc: 'All products are carefully checked to ensure you receive only the best quality.',
  },
  {
    icon: <FaHandsHelping className="feature-icon" />,
    title: 'Support Local Communities',
    desc: 'Your purchase helps empower local farmers and supports sustainable agriculture.',
  },
  {
    icon: <FaRegEye className="feature-icon" />,
    title: 'Easy & Transparent',
    desc: 'Our platform is easy to use and provides transparent information about products and pricing.',
  },
];

const WhyUs = () => {
  return (
    <div className="whyus-page">
      <Navbar />
      <motion.div
        className="whyus-container"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      >
        <h1>Why Choose Krishilink?</h1>
        <p className="whyus-intro">
          Krishilink is dedicated to connecting farmers directly with consumers and businesses, ensuring quality, transparency, and fair pricing for all.
        </p>
        <div className="whyus-features">
          {features.map((f, idx) => (
            <motion.div
              className="feature-card"
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + idx * 0.15, duration: 0.5, type: 'spring' }}
              whileHover={{ scale: 1.04, boxShadow: '0 6px 24px rgba(56,142,60,0.13)' }}
            >
              {f.icon}
              <h2>{f.title}</h2>
              <p>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
      <Footer />
    </div>
  );
};

export default WhyUs;