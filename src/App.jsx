import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LoanVerify from './pages/LoanVerify';

function App() {
  const PrivateRoute = ({ children }) => {
    const staffId = localStorage.getItem('staffId');
    return staffId ? children : <Navigate to="/login" />;
  };

  return (
    <Router>
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
