import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../services/apiClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('garuda_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!localStorage.getItem('garuda_access_token')
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // ─── Login ─────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.post('/employee/login', { email, password });

      const { accessToken, refreshToken, data: employee } = data;

      localStorage.setItem('garuda_access_token', accessToken);
      localStorage.setItem('garuda_refresh_token', refreshToken);
      localStorage.setItem('garuda_user', JSON.stringify(employee));

      setUser(employee);
      setIsAuthenticated(true);

      return data;
    } catch (err) {
      const message = err.response?.data?.error || err.response?.data?.message || 'Login failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ─── Logout ────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem('garuda_refresh_token');
      if (refreshToken) {
        await apiClient.post('/employee/logout', { refreshToken }).catch(() => {});
      }
    } finally {
      localStorage.removeItem('garuda_access_token');
      localStorage.removeItem('garuda_refresh_token');
      localStorage.removeItem('garuda_user');
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []);

  // ─── Fetch profile (validates token on mount) ──────────────────
  const fetchProfile = useCallback(async () => {
    const token = localStorage.getItem('garuda_access_token');
    if (!token) return;

    try {
      const { data } = await apiClient.get('/employee/profile');
      if (data.data) {
        setUser(data.data);
        localStorage.setItem('garuda_user', JSON.stringify(data.data));
        setIsAuthenticated(true);
      }
    } catch {
      // Token invalid — clear auth
      setIsAuthenticated(false);
      setUser(null);
    }
  }, []);

  // ─── Listen for auth expiry events from apiClient ──────────────
  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
      setIsAuthenticated(false);
    };

    window.addEventListener('garuda:auth:expired', handleAuthExpired);
    return () => window.removeEventListener('garuda:auth:expired', handleAuthExpired);
  }, []);

  // ─── Validate token on initial mount ───────────────────────────
  useEffect(() => {
    if (isAuthenticated) {
      fetchProfile();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const value = {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    fetchProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
