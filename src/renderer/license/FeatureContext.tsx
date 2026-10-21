import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  AccountStatus,
  FeatureMap,
  LicenseClient,
  PlanInfo,
  PopupConfig,
  UserInfo} from './apiClient';
import {
  getLicenseClient,
  secureStorage,
} from './apiClient';

interface LicenseState {
  ready: boolean;
  user: UserInfo | null;
  plan: PlanInfo | null;
  features: FeatureMap;
  accountStatus: AccountStatus | null;
  popup: PopupConfig | null;
  client: LicenseClient;

  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;

  hasFeature: (code: string) => boolean;
  featureLimit: (code: string) => number | null;
  showUpgradePopup: (code?: string) => Promise<void>;
  closePopup: () => void;
}

const LicenseContext = createContext<LicenseState | null>(null);

interface ProviderProps {
  client: LicenseClient;
  children: React.ReactNode;
}

export const LicenseProvider: React.FC<ProviderProps> = ({ client, children }) => {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [features, setFeatures] = useState<FeatureMap>({});
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [popup, setPopup] = useState<PopupConfig | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const f = await client.getFeatures();
      setPlan(f.plan);
      setFeatures(f.features ?? {});
      const s = await client.getAccountStatus();
      setAccountStatus(s);
      if (s.popup) setPopup(s.popup);
    } catch (e) {
      console.warn('[license] refresh failed', e);
    }
  }, [client]);

  // Initial bootstrap
  useEffect(() => {
    let mounted = true;
    (async () => {
      const u = await secureStorage.getUser();
      if (mounted) setUser(u);
      if (u) await refresh();
      if (mounted) setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, [refresh]);

  // Auto-refresh tiap 10 menit selama login
  useEffect(() => {
    if (!user) return;
    refreshTimer.current = setInterval(() => refresh(), 10 * 60 * 1000);
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [user, refresh]);

  // Listen ke event feature locked dari interceptor
  useEffect(() => {
    const handler = async (e: any) => {
      const detail = e.detail ?? {};
      if (detail.popup) {
        setPopup(detail.popup);
      } else if (detail.error_code === 'FEATURE_LOCKED' || detail.error_code === 'LIMIT_REACHED') {
        const p = await client.getPopup('FEATURE_LOCKED');
        if (p) setPopup(p);
      } else if (detail.error_code === 'EXPIRED' || detail.error_code === 'NO_SUBSCRIPTION') {
        const p = await client.getPopup('EXPIRED');
        if (p) setPopup(p);
      }
    };
    window.addEventListener('license:feature-locked', handler);
    return () => window.removeEventListener('license:feature-locked', handler);
  }, [client]);

  const login = useCallback(
    async (email: string, password: string) => {
      const u = await client.login(email, password);
      setUser(u);
      await refresh();
    },
    [client, refresh],
  );

  const register = useCallback(
    async (name: string, email: string, password: string, phone?: string) => {
      const u = await client.registerDemo(name, email, password, phone);
      setUser(u);
      await refresh();
    },
    [client, refresh],
  );

  const logout = useCallback(async () => {
    await client.logout();
    setUser(null);
    setPlan(null);
    setFeatures({});
    setAccountStatus(null);
    setPopup(null);
  }, [client]);

  const hasFeature = useCallback(
    (code: string) => !!features[code]?.enabled,
    [features],
  );
  const featureLimit = useCallback(
    (code: string) => features[code]?.limit ?? null,
    [features],
  );

  const showUpgradePopup = useCallback(
    async (code = 'FEATURE_LOCKED') => {
      const p = await client.getPopup(code);
      if (p) setPopup(p);
    },
    [client],
  );

  const closePopup = useCallback(() => setPopup(null), []);

  const value: LicenseState = useMemo(
    () => ({
      ready,
      user,
      plan,
      features,
      accountStatus,
      popup,
      client,
      login,
      register,
      logout,
      refresh,
      hasFeature,
      featureLimit,
      showUpgradePopup,
      closePopup,
    }),
    [
      ready,
      user,
      plan,
      features,
      accountStatus,
      popup,
      client,
      login,
      register,
      logout,
      refresh,
      hasFeature,
      featureLimit,
      showUpgradePopup,
      closePopup,
    ],
  );

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
};

export function useLicense(): LicenseState {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error('useLicense harus dipakai di dalam <LicenseProvider>');
  return ctx;
}

export function useFeature(code: string) {
  const { hasFeature, featureLimit, showUpgradePopup } = useLicense();
  return {
    enabled: hasFeature(code),
    limit: featureLimit(code),
    showUpgrade: () => showUpgradePopup('FEATURE_LOCKED'),
  };
}

// Helper standalone untuk modul non-React (mis. main process / utility)
export function dispatchFeatureLocked(detail: {
  feature?: string;
  error_code?: string;
  popup?: PopupConfig;
}) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('license:feature-locked', { detail }));
  }
}

export { getLicenseClient };
