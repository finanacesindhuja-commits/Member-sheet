import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LoanVerify from './pages/LoanVerify';

const AutoLogoutHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let timeoutId;
    const logout = () => {
      if (sessionStorage.getItem('staffId')) {
        sessionStorage.removeItem('staffId');
        sessionStorage.removeItem('staffName');
        navigate('/login');
      }
    };

    const resetTimeout = () => {
      clearTimeout(timeoutId);
      // 10 minutes inactivity timeout
      timeoutId = setTimeout(logout, 600000);
    };

    const events = ['mousemove', 'keydown', 'scroll', 'click'];
    events.forEach(event => window.addEventListener(event, resetTimeout));
    resetTimeout();

    return () => {
      events.forEach(event => window.removeEventListener(event, resetTimeout));
      clearTimeout(timeoutId);
    };
  }, [navigate]);

  return null;
};

function App() {
  const PrivateRoute = ({ children }) => {
    const staffId = sessionStorage.getItem('staffId');
    return staffId ? children : <Navigate to="/login" />;
  };

  return (
    <Router>
      <AutoLogoutHandler />
      <div className="min-h-screen font-sans">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          } />
          <Route path="/verify/:loanId" element={<LoanVerify />} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
