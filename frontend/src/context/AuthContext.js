import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../config/api';
import toast from 'react-hot-toast';

const AuthContext = createContext();
const extractErrorMessage = (error, fallbackMessage) => {
  const data = error?.response?.data;
  if (!data) return fallbackMessage;
  if (typeof data.message === 'string' && data.message.trim()) return data.message;
  if (Array.isArray(data.errors) && data.errors.length > 0) {
    return data.errors[0].msg || fallbackMessage;
  }
  return fallbackMessage;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
    } catch (error) {
      console.error('Fetch user error:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      
      if (response.data.requiresOTP) {
        return { requiresOTP: true, email, devOtp: response.data.devOtp };
      }
      
      return response.data;
    } catch (error) {
      throw { message: extractErrorMessage(error, 'Login failed') };
    }
  };

  const register = async (userData) => {
    try {
      const response = await api.post('/auth/register', userData);
      
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        setToken(response.data.token);
        setUser(response.data);
        toast.success('Registration successful!');
      }
      
      return response.data;
    } catch (error) {
      throw { message: extractErrorMessage(error, 'Registration failed') };
    }
  };

  const verifyOTP = async (email, otp) => {
    try {
      const response = await api.post('/auth/verify-otp', { email, otp });
      
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        setToken(response.data.token);
        setUser(response.data);
        toast.success('Login successful!');
      }
      
      return response.data;
    } catch (error) {
      throw { message: extractErrorMessage(error, 'OTP verification failed') };
    }
  };

  const resendOTP = async (email) => {
    try {
      const response = await api.post('/auth/resend-otp', { email });
      toast.success('OTP resent successfully!');
      return response.data;
    } catch (error) {
      throw { message: extractErrorMessage(error, 'Failed to resend OTP') };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    toast.success('Logged out successfully');
  };

  const updateUser = (updatedData) => {
    setUser(prev => ({ ...prev, ...updatedData }));
  };

  const value = {
    user,
    loading,
    login,
    register,
    verifyOTP,
    resendOTP,
    logout,
    updateUser,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
