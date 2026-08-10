'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi } from '@/lib/services';
import {
  clearSession,
  getProjectCode,
  getStoredUser,
  getToken,
  setProjectCode,
  setSession,
} from '@/lib/api';
import { can as checkPermission } from '@/lib/permissions';
import type { AdminProject, AdminUser } from '@/lib/types';

function pickProjectCode(projects: AdminProject[], preferred?: string | null): string | null {
  if (!projects.length) return null;
  if (preferred && projects.some((p) => p.code === preferred)) return preferred;
  return projects[0]?.code ?? null;
}

function mergeUser(user: AdminUser, projects?: AdminProject[]): AdminUser {
  return {
    ...user,
    projects: projects ?? user.projects ?? [],
  };
}

type AuthState = {
  user: AdminUser | null;
  ready: boolean;
  projects: AdminProject[];
  projectCode: string | null;
  serviceClusters: AdminProject['service_clusters'];
  setActiveProject: (code: string) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (permission: string) => boolean;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [ready, setReady] = useState(false);
  const [projectCode, setProjectCodeState] = useState<string | null>(null);

  const applyProjects = useCallback((nextUser: AdminUser, preferred?: string | null) => {
    const projects = nextUser.projects ?? [];
    const code = pickProjectCode(projects, preferred ?? getProjectCode());
    setProjectCode(code);
    setProjectCodeState(code);
    setUser(mergeUser(nextUser, projects));
  }, []);

  useEffect(() => {
    const token = getToken();
    const cached = getStoredUser<AdminUser>();
    if (!token) {
      setReady(true);
      return;
    }
    if (cached) {
      applyProjects(cached, getProjectCode());
    }
    authApi
      .me()
      .then((me) => {
        const tokenNow = getToken();
        if (tokenNow) setSession(tokenNow, me);
        applyProjects(me, getProjectCode());
      })
      .catch(() => {
        clearSession();
        setUser(null);
        setProjectCodeState(null);
      })
      .finally(() => setReady(true));
  }, [applyProjects]);

  const refreshMe = useCallback(async () => {
    const me = await authApi.me();
    const token = getToken();
    if (token) setSession(token, me);
    applyProjects(me, getProjectCode());
  }, [applyProjects]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await authApi.login(email, password);
      const merged = mergeUser(data.user, data.projects ?? []);
      setSession(data.token, merged);
      const code = pickProjectCode(merged.projects ?? [], data.projects?.[0]?.code);
      setProjectCode(code);
      setProjectCodeState(code);
      try {
        const me = await authApi.me();
        setSession(data.token, me);
        applyProjects(me, code);
      } catch {
        applyProjects(merged, code);
      }
    },
    [applyProjects],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* ignore */
    }
    clearSession();
    setUser(null);
    setProjectCodeState(null);
  }, []);

  const setActiveProject = useCallback(
    (code: string) => {
      setProjectCode(code);
      setProjectCodeState(code);
      void authApi
        .me()
        .then((me) => {
          const token = getToken();
          if (token) setSession(token, me);
          applyProjects(me, code);
        })
        .catch(() => {
          /* keep local project switch even if me fails */
        });
    },
    [applyProjects],
  );

  const can = useCallback(
    (permission: string) => checkPermission(user, permission, projectCode),
    [user, projectCode],
  );

  const value = useMemo(
    () => ({
      user,
      ready,
      projects: user?.projects ?? [],
      projectCode,
      serviceClusters: user?.current_project?.service_clusters,
      setActiveProject,
      login,
      logout,
      can,
      refreshMe,
    }),
    [user, ready, projectCode, setActiveProject, login, logout, can, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
