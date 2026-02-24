import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Connections from './pages/Connections';
import Messages from './pages/Messages';
import Profile from './pages/Profile';
import BuyTokens from './pages/BuyTokens';
import PaymentHistory from './pages/PaymentHistory';
import Navbar from './components/Navbar';
import PrivateRoute from './components/PrivateRoute';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { useAuth } from './context/AuthContext';
import './App.css';

const AppShell = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="App">
      <Navbar />
      <main className={`main-content ${isAuthenticated ? 'with-sidebar' : ''}`}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/connections" element={<PrivateRoute><Connections /></PrivateRoute>} />
          <Route path="/messages" element={<PrivateRoute><Messages /></PrivateRoute>} />
          <Route path="/messages/:userId" element={<PrivateRoute><Messages /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
          <Route path="/buy-tokens" element={<PrivateRoute><BuyTokens /></PrivateRoute>} />
          <Route path="/payment-history" element={<PrivateRoute><PaymentHistory /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <AppShell />
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
