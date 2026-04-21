import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { jsonApi } from "../api/jsonApi";

const AUTH_STORAGE_KEY = "newdiary-auth-user";
const AuthContext = createContext(null);

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
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState(null);
  const [bootstrap, setBootstrap] = useState(null);
  const [bootstrapLoading, setBootstrapLoading] = useState(false);
  const [bootstrapError, setBootstrapError] = useState(null);
  const [registrationOptions, setRegistrationOptions] = useState([]);
  const [registrationLoading, setRegistrationLoading] = useState(true);
  const [registrationError, setRegistrationError] = useState(null);
  const [registrationSubmitting, setRegistrationSubmitting] = useState(false);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);

    try {
      const nextUsers = await jsonApi.listUsers();
      setUsers(nextUsers);

      if (selectedUserId && !nextUsers.some((user) => user.id === selectedUserId)) {
        setSelectedUserId(null);
        setStoredUserId(null);
      }
    } catch (error) {
      setUsersError(error);
    } finally {
      setUsersLoading(false);
    }
  }, [selectedUserId]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

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

  const switchUser = useCallback((userId) => {
    setSelectedUserId(userId);
    setStoredUserId(userId);
  }, []);

  const logout = useCallback(() => {
    setSelectedUserId(null);
    setBootstrap(null);
    setBootstrapError(null);
    setStoredUserId(null);
  }, []);

  const registerParticipant = useCallback(
    async (payload) => {
      setRegistrationSubmitting(true);
      setRegistrationError(null);

      try {
        const result = await jsonApi.registerParticipant(payload);
        await loadUsers();
        setSelectedUserId(result.user.id);
        setStoredUserId(result.user.id);
        return result.user;
      } catch (error) {
        setRegistrationError(error);
        return null;
      } finally {
        setRegistrationSubmitting(false);
      }
    },
    [loadUsers],
  );

  const value = useMemo(
    () => ({
      users,
      currentUser,
      switchUser,
      logout,
      bootstrap,
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
