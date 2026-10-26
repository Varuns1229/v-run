import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!tokenStore.get()) return;
    api
      .get('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, [logout]);

  const handleAuth = useCallback((d) => {
    tokenStore.set(d.token);
    setUser(d.user);
    return d.user;
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login: (email, password) => api.post('/auth/login', { email, password }).then(handleAuth),
      signup: (name, email, password) => api.post('/auth/signup', { name, email, password }).then(handleAuth),
      logout,
      refreshUser: () => api.get('/auth/me').then((d) => setUser(d.user)),
      updateProfile: (patch) => api.patch('/auth/me', patch).then((d) => setUser(d.user)),
    }),
    [user, loading, logout, handleAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
