// import React, { useState, useEffect } from 'react';
// import { useAuth } from '../context/AuthContext';

// const TokenMonitor = () => {
//   const { user, sessionToken, isTokenValid, refreshSession } = useAuth();
//   const [tokenInfo, setTokenInfo] = useState({
//     hasToken: false,
//     tokenPreview: '',
//     sessionId: '',
//     lastUpdated: null
//   });

//   useEffect(() => {
//     const updateTokenInfo = () => {
//       const token = localStorage.getItem('authToken');
//       const sessionId = sessionStorage.getItem('krishilink_session_id');
      
//       setTokenInfo({
//         hasToken: !!token,
//         tokenPreview: token ? `${token.substring(0, 20)}...` : 'No token',
//         sessionId: sessionId || 'No session ID',
//         lastUpdated: new Date().toLocaleTimeString()
//       });
//     };

//     updateTokenInfo();
    
//     // Update every 5 seconds to monitor changes
//     const interval = setInterval(updateTokenInfo, 5000);
    
//     return () => clearInterval(interval);
//   }, [sessionToken]);

//   const handleRefreshToken = async () => {
//     const success = await refreshSession();
//     if (success) {
//       alert('Token refreshed successfully!');
//     } else {
//       alert('Token refresh failed. You may need to log in again.');
//     }
//   };

//   const handleForceLogout = () => {
//     localStorage.removeItem('authToken');
//     localStorage.removeItem('refreshToken');
//     localStorage.removeItem('user');
//     sessionStorage.removeItem('krishilink_session_id');
//     window.location.reload();
//   };

//   if (!user) {
//     return null; // Don't show monitor if not logged in
//   }

//   return (
//     <div style={{
//       position: 'fixed',
//       bottom: '20px',
//       right: '20px',
//       background: '#fff',
//       border: '1px solid #ddd',
//       borderRadius: '8px',
//       padding: '15px',
//       boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
//       fontSize: '12px',
//       maxWidth: '300px',
//       zIndex: 1000
//     }}>
//       <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>🔐 Token Monitor</h4>
      
//       <div style={{ marginBottom: '8px' }}>
//         <strong>Token:</strong> {tokenInfo.tokenPreview}
//       </div>
      
//       <div style={{ marginBottom: '8px' }}>
//         <strong>Session ID:</strong> {tokenInfo.sessionId.substring(0, 15)}...
//       </div>
      
//       <div style={{ marginBottom: '8px' }}>
//         <strong>Valid:</strong> {isTokenValid() ? '✅ Yes' : '❌ No'}
//       </div>
      
//       <div style={{ marginBottom: '12px' }}>
//         <strong>Last Updated:</strong> {tokenInfo.lastUpdated}
//       </div>
      
//       <div style={{ display: 'flex', gap: '8px' }}>
//         <button 
//           onClick={handleRefreshToken}
//           style={{
//             padding: '4px 8px',
//             fontSize: '10px',
//             background: '#007bff',
//             color: 'white',
//             border: 'none',
//             borderRadius: '4px',
//             cursor: 'pointer'
//           }}
//         >
//           Refresh
//         </button>
        
//         <button 
//           onClick={handleForceLogout}
//           style={{
//             padding: '4px 8px',
//             fontSize: '10px',
//             background: '#dc3545',
//             color: 'white',
//             border: 'none',
//             borderRadius: '4px',
//             cursor: 'pointer'
//           }}
//         >
//           Force Logout
//         </button>
//       </div>
      
//       <div style={{ 
//         fontSize: '10px', 
//         color: '#666', 
//         marginTop: '8px',
//         fontStyle: 'italic'
//       }}>
//         This monitor helps debug token changes
//       </div>
//     </div>
//   );
// };

// export default TokenMonitor; 