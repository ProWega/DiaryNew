import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { jsonApi } from "../api/jsonApi";

const AUTH_STORAGE_KEY = "newdiary-auth-user";
const AuthContext = createContext(null);

const DEFAULT_FEATURES = {
  appMode: "production",
  devAuth: false,
  magicLinks: true,
  setup: false,
};

function getStoredUserId() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  return window.localStorage.getItem(AUTH_STORAGE_KEY);
}

function setStoredUserId(userId) {
  if (typeof window !== "undefined" && window.localStorage) {
    if (userId) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, userId);
    } else {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }
}

export function AuthProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(getStoredUserId);
  const [features, setFeatures] = useState(DEFAULT_FEATURES);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState(null);
  const [bootstrap, setBootstrap] = useState(null);
  const [bootstrapLoading, setBootstrapLoading] = useState(false);
  const [bootstrapError, setBootstrapError] = useState(null);
  const [registrationOptions, setRegistrationOptions] = useState([]);
  const [registrationLoading, setRegistrationLoading] = useState(true);
  const [registrationError, setRegistrationError] = useState(null);
  const [registrationSubmitting, setRegistrationSubmitting] = useState(false);

  const loadAuthState = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);

    try {
      const authState = await jsonApi.getAuthMe();
      const nextFeatures = { ...DEFAULT_FEATURES, ...(authState.features || {}) };
      setFeatures(nextFeatures);

      if (nextFeatures.devAuth) {
        const nextUsers = await jsonApi.listUsers();
        const storedUserId = getStoredUserId();
        const nextSelectedUserId =
          (storedUserId && nextUsers.some((user) => user.id === storedUserId) && storedUserId) ||
          authState.user?.id ||
          null;
        setUsers(nextUsers);
        setSelectedUserId(nextSelectedUserId);
        setStoredUserId(nextSelectedUserId);
        return { users: nextUsers, user: nextUsers.find((user) => user.id === nextSelectedUserId) || null };
      }

      const nextUsers = authState.user ? [authState.user] : [];
      setUsers(nextUsers);
      setSelectedUserId(authState.user?.id || null);
      setStoredUserId(null);
      return { users: nextUsers, user: authState.user || null };
    } catch (error) {
      setUsers([]);
      setSelectedUserId(null);
      setUsersError(error);
      return { users: [], user: null };
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAuthState();
  }, [loadAuthState]);

  useEffect(() => {
    let isMounted = true;

    async function loadRegistrationOptions() {
      setRegistrationLoading(true);
      setRegistrationError(null);

      try {
        const nextOptions = await jsonApi.listPublicEvents();
        if (isMounted) {
          setRegistrationOptions(nextOptions);
        }
      } catch (error) {
        if (isMounted) {
          setRegistrationError(error);
        }
      } finally {
        if (isMounted) {
          setRegistrationLoading(false);
        }
      }
    }

    loadRegistrationOptions();

    return () => {
      isMounted = false;
    };
  }, []);

  const currentUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users],
  );

  const refreshBootstrap = useCallback(async () => {
    if (!currentUser) {
      setBootstrap(null);
      setBootstrapLoading(false);
      setBootstrapError(null);
      return;
    }

    setBootstrapLoading(true);
    setBootstrapError(null);

    try {
      const nextBootstrap = await jsonApi.getBootstrap(currentUser.id);
      setBootstrap(nextBootstrap);
    } catch (error) {
      setBootstrapError(error);
    } finally {
      setBootstrapLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    refreshBootstrap();
  }, [refreshBootstrap]);

  const switchUser = useCallback(
    (userId) => {
      if (!features.devAuth) {
        return;
      }

      setSelectedUserId(userId);
      setStoredUserId(userId);
    },
    [features.devAuth],
  );

  const logout = useCallback(async () => {
    try {
      await jsonApi.logout();
    } catch {
      // Local logout should still clear client state if the network request fails.
    }
    setSelectedUserId(null);
    setUsers(features.devAuth ? users : []);
    setBootstrap(null);
    setBootstrapError(null);
    setStoredUserId(null);
  }, [features.devAuth, users]);

  const registerParticipant = useCallback(
    async (payload) => {
      setRegistrationSubmitting(true);
      setRegistrationError(null);

      try {
        const result = await jsonApi.registerParticipant(payload);
        await loadAuthState();
        if (features.devAuth && result.user?.id) {
          setSelectedUserId(result.user.id);
          setStoredUserId(result.user.id);
        }
        return result.user;
      } catch (error) {
        setRegistrationError(error);
        return null;
      } finally {
        setRegistrationSubmitting(false);
      }
    },
    [features.devAuth, loadAuthState],
  );

  const value = useMemo(
    () => ({
      users,
      currentUser,
      switchUser,
      logout,
      features,
      bootstrap,
      refreshUsers: loadAuthState,
      refreshAuth: loadAuthState,
      refreshBootstrap,
      registrationOptions,
      registerParticipant,
      registrationLoading,
      registrationError,
      registrationSubmitting,
      loading: usersLoading || bootstrapLoading,
      usersLoading,
      bootstrapLoading,
      usersError,
      bootstrapError,
    }),
    [
      bootstrap,
      bootstrapError,
      bootstrapLoading,
      currentUser,
      features,
      loadAuthState,
      logout,
      refreshBootstrap,
      registerParticipant,
      registrationError,
      registrationLoading,
      registrationOptions,
      registrationSubmitting,
      switchUser,
      users,
      usersError,
      usersLoading,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
