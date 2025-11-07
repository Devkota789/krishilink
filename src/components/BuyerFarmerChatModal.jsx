import React from "react";

// Minimal buyer-farmer chat modal used by Products page.
// Props: productId (string|number), open (bool), onClose (fn)
export default function BuyerFarmerChatModal({ productId, open, onClose }) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2500,
      }}
    >
      <div
        style={{
          width: 680,
          maxWidth: "95%",
          background: "#fff",
          borderRadius: 8,
          padding: 18,
          boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0 }}>Chat about product #{productId || "-"}</h3>
          <button onClick={onClose} style={{ cursor: "pointer" }}>
            Close
          </button>
        </div>
        <div style={{ marginTop: 12 }}>
          <p style={{ color: "#444" }}>
            This is a lightweight placeholder for buyer-farmer chat. The full
            chat implementation lives elsewhere in the codebase (or can be
            implemented later). For now it prevents import errors and allows the
            product page to render.
          </p>
        </div>
      </div>
    </div>
  );
}
