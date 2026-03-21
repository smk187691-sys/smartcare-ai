
import React, { createContext, useContext, useState, useCallback } from 'react';
import { User } from '../types';

const USERS_KEY = 'smartcare_users';
const SESSION_KEY = 'smartcare_session';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => { success: boolean; error?: string };
  signup: (name: string, email: string, password: string, phoneNumber?: string) => { success: boolean; error?: string };
  sendOtp: (phoneNumber: string) => { success: boolean; error?: string };
  verifyOtp: (phoneNumber: string, otp: string, name?: string, email?: string) => { success: boolean; error?: string };
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const hashPassword = (password: string): string => btoa(encodeURIComponent(password));

const getUsers = (): User[] => {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); }
  catch { return []; }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const sessionId = localStorage.getItem(SESSION_KEY);
      if (!sessionId) return null;
      return getUsers().find(u => u.id === sessionId) || null;
    } catch { return null; }
  });

  const login = useCallback((email: string, password: string) => {
    const found = getUsers().find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (!found) return { success: false, error: 'No account found with this email.' };
    if (found.passwordHash !== hashPassword(password)) return { success: false, error: 'Incorrect password.' };
    localStorage.setItem(SESSION_KEY, found.id);
    setUser(found);
    return { success: true };
  }, []);

  const sendOtp = useCallback((phoneNumber: string) => {
    // In a real app, this would call a backend to send an SMS
    console.log(`Sending OTP to ${phoneNumber}`);
    return { success: true };
  }, []);

  const verifyOtp = useCallback((phoneNumber: string, otp: string, name?: string, email?: string) => {
    // Simulated OTP verification - '123456' is always correct
    if (otp !== '123456') return { success: false, error: 'Invalid OTP. Please try again with 123456.' };

    const users = getUsers();
    let found = users.find(u => u.phoneNumber === phoneNumber);

    if (!found) {
      found = {
        id: crypto.randomUUID(),
        name: name || 'SmartCare User',
        phoneNumber,
        email: email || undefined,
        joinedAt: new Date().toISOString(),
      };
      localStorage.setItem(USERS_KEY, JSON.stringify([...users, found]));
    } else if (name || email) {
      // Update existing user details if provided and missing
      const updatedUser = {
        ...found,
        name: name || found.name,
        email: email || found.email
      };
      const updatedUsers = users.map(u => u.id === found?.id ? updatedUser : u);
      localStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers));
      found = updatedUser;
    }

    localStorage.setItem(SESSION_KEY, found.id);
    setUser(found);
    return { success: true };
  }, []);

  const signup = useCallback((name: string, email: string, password: string, phoneNumber?: string) => {
    const users = getUsers();
    if (email && users.find(u => u.email?.toLowerCase() === email.toLowerCase()))
      return { success: false, error: 'An account with this email already exists.' };
    if (phoneNumber && users.find(u => u.phoneNumber === phoneNumber))
      return { success: false, error: 'An account with this phone number already exists.' };
      
    const newUser: User = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: email ? email.toLowerCase().trim() : undefined,
      phoneNumber,
      passwordHash: password ? hashPassword(password) : undefined,
      joinedAt: new Date().toISOString(),
    };
    localStorage.setItem(USERS_KEY, JSON.stringify([...users, newUser]));
    localStorage.setItem(SESSION_KEY, newUser.id);
    setUser(newUser);
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, signup, sendOtp, verifyOtp, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
