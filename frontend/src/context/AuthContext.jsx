import { createContext, useContext, useState, useCallback } from 'react';
import api from '../api/axios.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(false);

  const persist = (token, userObj) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userObj));
    setUser(userObj);
  };

  const register = useCallback(async ({ name, email, password }) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', { name, email, password });
      persist(data.token, data.user);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Registration failed' };
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async ({ email, password }) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      persist(data.token, data.user);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Login failed' };
    } finally {
      setLoading(false);
    }
  }, []);

  const forgotPassword = useCallback(async (email) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      return { success: true, message: data.message };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Something went wrong' };
    } finally {
      setLoading(false);
    }
  }, []);

  const resetPassword = useCallback(async (token, password) => {
    setLoading(true);
    try {
      const { data } = await api.post(`/auth/reset-password/${token}`, { password });
      persist(data.token, data.user);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Reset failed' };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  const updateUser = useCallback((userObj) => {
    localStorage.setItem('user', JSON.stringify(userObj));
    setUser(userObj);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, updateUser, forgotPassword, resetPassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
