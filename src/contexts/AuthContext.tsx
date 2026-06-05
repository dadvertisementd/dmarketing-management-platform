import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { LaravelUser, laravelApi } from '../lib/laravelApi';

export interface UserProfile {
  uid: string;
  id: number;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: LaravelUser['role'];
  title?: string | null;
  weeklyCapacity?: number;
  isActive?: boolean;
  avatarColor?: string | null;
}

interface AuthContextType {
  user: UserProfile | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
  isAgencyAdmin: boolean;
  isManager: boolean;
  isWorker: boolean;
  isClient: boolean;
  isAgency: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  login: async () => undefined,
  logout: async () => undefined,
  refreshUser: async () => undefined,
  isAdmin: false,
  isAgencyAdmin: false,
  isManager: false,
  isWorker: false,
  isClient: false,
  isAgency: false,
});

function toProfile(user: LaravelUser): UserProfile {
  return {
    uid: String(user.id),
    id: user.id,
    email: user.email,
    displayName: user.name,
    photoURL: null,
    role: user.role,
    title: user.title,
    weeklyCapacity: user.weekly_capacity,
    isActive: user.is_active,
    avatarColor: user.avatar_color,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    const response = await laravelApi.me();
    setUser(toProfile(response.user));
  };

  useEffect(() => {
    let mounted = true;

    laravelApi.me()
      .then((response) => {
        if (mounted) setUser(toProfile(response.user));
      })
      .catch(() => {
        if (mounted) setUser(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handleExpiredSession = () => setUser(null);

    window.addEventListener('laravel-auth-expired', handleExpiredSession);

    return () => {
      window.removeEventListener('laravel-auth-expired', handleExpiredSession);
    };
  }, []);

  const login = async (email: string, password: string) => {
    const response = await laravelApi.login(email, password);
    setUser(toProfile(response.user));
  };

  const logout = async () => {
    await laravelApi.logout().catch(() => undefined);
    setUser(null);
  };

  const value = useMemo(() => {
    const isAdmin = user?.role === 'admin';
    const isManager = user?.role === 'admin' || user?.role === 'manager';
    const isWorker = isManager || user?.role === 'worker';
    const isAgency = isWorker;
    const isClient = user?.role === 'client' && !isAgency;

    return {
      user,
      userProfile: user,
      loading,
      login,
      logout,
      refreshUser,
      isAdmin,
      isAgencyAdmin: isManager,
      isManager,
      isWorker,
      isClient,
      isAgency,
    };
  }, [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
