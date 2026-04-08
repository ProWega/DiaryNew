import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { jsonApi } from "../api/jsonApi";

const AUTH_STORAGE_KEY = "newdiary-auth-user";
const AuthContext = createContext(null);

function getStoredUserId() {
  if (typeof window === "undefined" || !window.localStorage) {
    return "user-participant-1";
  }

  return window.localStorage.getItem(AUTH_STORAGE_KEY) || "user-participant-1";
}

function setStoredUserId(userId) {
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, userId);
  }
}

export function AuthProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(getStoredUserId);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState(null);
  const [bootstrap, setBootstrap] = useState(null);
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadUsers() {
      setUsersLoading(true);
      setUsersError(null);

      try {
        const nextUsers = await jsonApi.listUsers();

        if (!isMounted) {
          return;
        }

        setUsers(nextUsers);

        if (!nextUsers.some((user) => user.id === selectedUserId) && nextUsers[0]) {
          setSelectedUserId(nextUsers[0].id);
          setStoredUserId(nextUsers[0].id);
        }
      } catch (error) {
        if (isMounted) {
          setUsersError(error);
        }
      } finally {
        if (isMounted) {
          setUsersLoading(false);
        }
      }
    }

    loadUsers();

    return () => {
      isMounted = false;
    };
  }, [selectedUserId]);

  const currentUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users],
  );

  const refreshBootstrap = useCallback(async () => {
    if (!currentUser) {
      setBootstrap(null);
      setBootstrapLoading(false);
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

  const value = useMemo(
    () => ({
      users,
      currentUser,
      switchUser,
      bootstrap,
      refreshBootstrap,
      loading: usersLoading || bootstrapLoading,
      usersLoading,
      bootstrapLoading,
      usersError,
      bootstrapError,
    }),
    [
      bootstrap,
      bootstrapLoading,
      bootstrapError,
      currentUser,
      refreshBootstrap,
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
