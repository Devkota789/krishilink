import React, { useState, useEffect } from 'react';
import { orderAPI } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { FaShoppingCart, FaTimes, FaTrash, FaCheck } from 'react-icons/fa';
import './BulkOrderModal.css';

const BulkOrderModal = ({ isOpen, onClose, cartItems, onOrderSuccess, onRemoveItem, onUpdateQuantity }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const { user } = useAuth();

  const calculateTotal = () => {
    return cartItems.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
  };

  const handlePlaceBulkOrder = async () => {
    if (!user) {
      setError('Please login to place orders');
      return;
    }

    if (user.role !== 'buyer') {
      setError('Only buyers can place orders');
      return;
    }

    // Check if user has valid authentication
    const token = localStorage.getItem('authToken');
    if (!token) {
      setError('Authentication token missing. Please login again.');
      return;
    }

    console.log('Bulk order - User authenticated:', !!user);
    console.log('Bulk order - Token exists:', !!token);
    console.log('Bulk order - User role:', user.role);

    if (cartItems.length === 0) {
      setError('Cart is empty');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Prepare bulk order data according to API specification
      const bulkOrderData = cartItems.map(item => ({
        productId: item.id,
        productQuantity: item.quantity,
        totalPrice: item.price * item.quantity,
        orderStatus: 'pending',
        paymentStatus: 'pending',
        refundStatus: 'none'
      }));

      console.log('Sending bulk order request with token:', token.substring(0, 20) + '...');
      console.log('Bulk order data:', bulkOrderData);

      const response = await orderAPI.addOrders(bulkOrderData);
      
      if (response.data) {
        setSuccess(true);
        setTimeout(() => {
          onOrderSuccess();
          onClose();
          setSuccess(false);
        }, 2000);
      }
    } catch (err) {
      console.error('Bulk order error:', err);
      console.error('Error response:', err.response);
      setError(err.response?.data?.message || 'Failed to place orders. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
      setError(null);
      setSuccess(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="bulk-order-modal-overlay" onClick={handleClose}>
      <div className="bulk-order-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="bulk-order-modal-header">
          <h2>
            <FaShoppingCart /> Shopping Cart ({cartItems.length} items)
          </h2>
          <button className="close-btn" onClick={handleClose} disabled={loading}>
            <FaTimes />
          </button>
        </div>

        <div className="bulk-order-modal-body">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {success && (
            <div className="success-message">
              <FaCheck /> Orders placed successfully! Redirecting...
            </div>
          )}

          {cartItems.length === 0 ? (
            <div className="empty-cart">
              <p>Your cart is empty</p>
              <p>Add some products to get started!</p>
            </div>
          ) : (
            <>
              <div className="cart-items">
                {cartItems.map((item, index) => (
                  <div key={index} className="cart-item">
                    <div className="item-image">
                      <img 
                        src={item.imageUrl || 'https://via.placeholder.com/60x60?text=No+Image'} 
                        alt={item.name}
                        onError={(e) => {
                          e.target.src = 'https://via.placeholder.com/60x60?text=No+Image';
                        }}
                      />
                    </div>
                    <div className="item-details">
                      <h4>{item.name}</h4>
                      <p className="item-price">₹{item.price} per kg</p>
                      <p className="item-seller">Seller: {item.sellerName}</p>
                    </div>
                    <div className="item-quantity">
                      <label>Quantity (kg):</label>
                      <input
                        type="number"
                        min="1"
                        max={item.availableQuantity || 999}
                        value={item.quantity}
                        onChange={(e) => onUpdateQuantity(index, parseInt(e.target.value) || 1)}
                        disabled={loading}
                      />
                    </div>
                    <div className="item-total">
                      <p>₹{item.price * item.quantity}</p>
                    </div>
                    <button
                      className="remove-item-btn"
                      onClick={() => onRemoveItem(index)}
                      disabled={loading}
                    >
                      <FaTrash />
                    </button>
                  </div>
                ))}
              </div>

              <div className="cart-summary">
                <div className="summary-row">
                  <span>Total Items:</span>
                  <span>{cartItems.length}</span>
                </div>
                <div className="summary-row">
                  <span>Total Quantity:</span>
                  <span>{cartItems.reduce((total, item) => total + item.quantity, 0)} kg</span>
                </div>
                <div className="summary-row total">
                  <span>Total Amount:</span>
                  <span>₹{calculateTotal()}</span>
                </div>
              </div>

              <div className="cart-actions">
                <button
                  className="place-order-btn"
                  onClick={handlePlaceBulkOrder}
                  disabled={loading || cartItems.length === 0}
                >
                  {loading ? 'Placing Orders...' : 'Place All Orders'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkOrderModal; 