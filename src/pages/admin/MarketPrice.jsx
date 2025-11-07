import React from "react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";

const MarketPrice = () => {
  return (
    <div
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      <Navbar />
      <main style={{ paddingTop: 90, paddingInline: 24, flex: 1 }}>
        <h1>Market Price Intelligence</h1>
        <p>Aggregate and manage commodity pricing. (Placeholder)</p>
      </main>
      <Footer />
    </div>
  );
};

export default MarketPrice;
