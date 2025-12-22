import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@/types';
import api from '@/services/api';
import { toast } from 'sonner';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: User) => void;
  logout: () => void;
  updateCurrentUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initial Load - Check generic user ID from local storage
    const checkAuth = async () => {
      try {
        // 1. Try to load cached user first for immediate UI (Optimistic Load)
        const cachedUserStr = localStorage.getItem('velvii_current_user');
        let cachedUser: User | null = null;

        if (cachedUserStr) {
          try {
            cachedUser = JSON.parse(cachedUserStr);
            setCurrentUser(cachedUser);
            setIsLoading(false); // Render app immediately
          } catch (e) {
            console.error("Failed to parse cached user", e);
          }
        }

        const storedUserId = localStorage.getItem('velvii_current_user_id');

        if (storedUserId) {
          if (storedUserId === 'admin-session') {
            // Admin handling - Allow persistence if we have cached user data
            if (cachedUser && cachedUser.isAdmin) {
              console.log("Restoring Admin Session");
              setIsLoading(false);
            } else {
              // Only clear if no valid cached admin data
              console.warn("Invalid admin session, clearing.");
              localStorage.removeItem('velvii_current_user_id');
              localStorage.removeItem('velvii_current_user');
              setCurrentUser(null);
              setIsLoading(false);
            }
          } else {
            // 2. Re-validate with API in background
            try {
              const res = await api.get(`/users/${storedUserId}`);
              const user = res.data;
              if (user) {
                setCurrentUser(user);
                localStorage.setItem('velvii_current_user', JSON.stringify(user));
              }
            } catch (err: any) {
              console.error("Auth validation error:", err);
              // CRITICAL FIX: Only logout if explicit auth error (404 - User Not Found)
              // We ignore 401/403 here because session cookies might be lost on browser close,
              // but we want to trust the persisted localStorage session for a seamless experience.
              if (err.response && err.response.status === 404) {
                console.log("User not found (404), logging out.");
                localStorage.removeItem('velvii_current_user_id');
                localStorage.removeItem('velvii_current_user');
                setCurrentUser(null);
              } else {
                console.log("Network/Auth error (401/403/500), preserving cached session.");
              }
            }
          }
        } else {
          // No stored ID -> definitely logged out
          localStorage.removeItem('velvii_current_user');
          setCurrentUser(null);
        }

      } catch (error) {
        console.error("Auth Check Fatal Error:", error);
        // Fallback
        setCurrentUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = (user: User) => {
    setCurrentUser(user);
    if (user.id) {
      localStorage.setItem('velvii_current_user_id', user.id);
      localStorage.setItem('velvii_current_user', JSON.stringify(user));
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('velvii_current_user_id');
    localStorage.removeItem('velvii_current_user');
    // Clear other local keys if any
    localStorage.removeItem('velvii_saved_accounts');
  };

  const updateCurrentUser = async (updates: Partial<User>) => {
    if (currentUser && currentUser.id) {
      try {
        // Optimistic update
        setCurrentUser({ ...currentUser, ...updates });

        // API update
        await api.put(`/users/${currentUser.id}`, updates);
      } catch (error) {
        console.error("Error updating user profile:", error);
        toast.error("Failed to update profile");
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        isLoading,
        login,
        logout,
        updateCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
