import React, { createContext, useState, useContext } from 'react';
import { api } from '../services/api';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  
  const login = async (loginId, password) => {
    const response = await api.auth.login(loginId, password);
    if (response.success) {
      setUser(response.user);
      return { success: true, user: response.user };
    }
    return { success: false, message: response.message };
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
