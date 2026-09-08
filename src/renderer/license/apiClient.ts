/**
 * License client API & secure storage for WariPOS.
 *
 * Bertanggung jawab atas:
 * - Memanggil license server (login, refresh, /user/features, /account/status, dll)
 * - Menyimpan token secara aman (electron-store + AES jika tersedia, fallback localStorage)
 * - Auto refresh access_token + dispatch event saat fitur terkunci
 */

import axios, {
  AxiosError,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

// ============================================================
// SECURE STORAGE
// ============================================================
//
// Saat berjalan di Electron renderer, app punya `window.api.license.*`
// yang ekspose helper terenkripsi dari main process. Kalau tidak ada
// (mode browser/dev), pakai localStorage biasa.

interface LicenseStorageBridge {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

const memoryStore: Record<string, string> = {};

const bridge: LicenseStorageBridge =
  (typeof window !== 'undefined' && (window as any).api?.license) || {
    async get(key: string) {
      try {
        return localStorage.getItem(key);
      } catch {
        return memoryStore[key] ?? null;
      }
    },
    async set(key: string, value: string) {
      try {
        localStorage.setItem(key, value);
      } catch {
        memoryStore[key] = value;
      }
    },
    async remove(key: string) {
      try {
        localStorage.removeItem(key);
      } catch {
        delete memoryStore[key];
      }
    },
  };

const KEYS = {
  access: 'license.access_token',
  refresh: 'license.refresh_token',
  user: 'license.user',
  device: 'license.device_id',
};

export const secureStorage = {
  async getAccess() {
    return bridge.get(KEYS.access);
  },
  async getRefresh() {
    return bridge.get(KEYS.refresh);
  },
  async getUser(): Promise<UserInfo | null> {
    const raw = await bridge.get(KEYS.user);
    return raw ? (JSON.parse(raw) as UserInfo) : null;
  },
  async getDeviceId(): Promise<string> {
    let id = await bridge.get(KEYS.device);
    if (!id) {
      id = generateDeviceId();
      await bridge.set(KEYS.device, id);
    }
    return id;
  },
  async setSession(access: string, refresh: string, user: UserInfo) {
    await bridge.set(KEYS.access, access);
    await bridge.set(KEYS.refresh, refresh);
    await bridge.set(KEYS.user, JSON.stringify(user));
  },
  async clearSession() {
    await bridge.remove(KEYS.access);
    await bridge.remove(KEYS.refresh);
    await bridge.remove(KEYS.user);
  },
};

function generateDeviceId(): string {
  const rand = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const platform =
    typeof navigator !== 'undefined' ? navigator.platform.replace(/\s+/g, '') : 'unknown';
  return `${platform}-${rand}`;
}

// ============================================================
// TYPES
// ============================================================
export interface UserInfo {
  id: number;
  name: string;
  email: string;
  role: string;
  must_change_pwd?: boolean;
}

export interface PlanInfo {
  code: string;
  name: string;
  status?: string;
  expired_at?: string | null;
}

export interface FeatureMap {
  [code: string]: { enabled: boolean; limit: number | null };
}

export interface PopupConfig {
  code: string;
  title: string;
  description?: string;
  cta_text?: string;
  cta_url?: string;
  whatsapp_number?: string;
  image_url?: string;
  pricing_html?: string;
}

export interface AccountStatus {
  plan: PlanInfo | null;
  status: string;
  expired_at: string | null;
  days_left: number;
  popup?: PopupConfig | null;
}

// ============================================================
// API CLIENT
// ============================================================
export interface LicenseClientOptions {
  baseURL: string;
  appPlatform?: string;
  appVersion?: string;
  onForceLogout?: () => void;
  onFeatureLocked?: (payload: {
    feature?: string;
    error_code?: string;
    popup?: PopupConfig;
  }) => void;
}

export class LicenseClient {
  private http: AxiosInstance;
  private refreshing: Promise<void> | null = null;
  private opts: LicenseClientOptions;

  constructor(opts: LicenseClientOptions) {
    this.opts = opts;
    this.http = axios.create({ baseURL: opts.baseURL, timeout: 15000 });

    this.http.interceptors.request.use(async (cfg: InternalAxiosRequestConfig) => {
      const token = await secureStorage.getAccess();
      if (token) cfg.headers.set('Authorization', `Bearer ${token}`);
      cfg.headers.set('X-Device-Id', await secureStorage.getDeviceId());
      if (opts.appVersion) cfg.headers.set('X-App-Version', opts.appVersion);
      return cfg;
    });

    this.http.interceptors.response.use(
      (r: AxiosResponse) => r,
      async (err: AxiosError<any>) => {
        const original: any = err.config;
        const status = err.response?.status;
        const data = err.response?.data;

        // Handle 401 → try refresh once
        if (status === 401 && !original._retry) {
          original._retry = true;
          try {
            await this.ensureRefreshed();
            return this.http.request(original);
          } catch {
            await this.logoutLocal();
            opts.onForceLogout?.();
          }
        }

        // Feature lock / expired / limit reached
        const code = data?.error_code;
        if (
          code === 'FEATURE_LOCKED' ||
          code === 'EXPIRED' ||
          code === 'NO_SUBSCRIPTION' ||
          code === 'LIMIT_REACHED' ||
          code === 'ACCOUNT_SUSPENDED'
        ) {
          opts.onFeatureLocked?.({
            feature: data?.feature,
            error_code: code,
            popup: data?.popup,
          });
        }
        return Promise.reject(err);
      },
    );
  }

  // -------- Auth --------
  async login(email: string, password: string) {
    const device_id = await secureStorage.getDeviceId();
    const r = await this.http.post('/auth/login', {
      email,
      password,
      device_id,
      device_name: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 80) : 'app',
      platform: this.opts.appPlatform,
    });
    await secureStorage.setSession(
      r.data.data.access_token,
      r.data.data.refresh_token,
      r.data.data.user,
    );
    return r.data.data.user as UserInfo;
  }

  async registerDemo(name: string, email: string, password: string, phone?: string) {
    const device_id = await secureStorage.getDeviceId();
    const r = await this.http.post('/auth/register-demo', {
      name,
      email,
      password,
      phone,
      device_id,
      platform: this.opts.appPlatform,
    });
    await secureStorage.setSession(
      r.data.data.access_token,
      r.data.data.refresh_token,
      r.data.data.user,
    );
    return r.data.data.user as UserInfo;
  }

  async logout() {
    try {
      const device_id = await secureStorage.getDeviceId();
      await this.http.post('/auth/logout', { device_id });
    } catch {
      /* ignore */
    }
    await this.logoutLocal();
  }

  async logoutLocal() {
    await secureStorage.clearSession();
  }

  async changePassword(oldPassword: string, newPassword: string) {
    await this.http.post('/auth/change-password', {
      old_password: oldPassword,
      new_password: newPassword,
    });
  }

  // -------- Refresh --------
  private async ensureRefreshed() {
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      const refresh_token = await secureStorage.getRefresh();
      const device_id = await secureStorage.getDeviceId();
      if (!refresh_token) throw new Error('No refresh token');
      const r = await axios.post(`${this.opts.baseURL}/auth/refresh`, {
        refresh_token,
        device_id,
      });
      const user = (await secureStorage.getUser()) ?? null;
      if (!user) throw new Error('No user info');
      await secureStorage.setSession(
        r.data.data.access_token,
        r.data.data.refresh_token,
        user,
      );
    })().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  // -------- Data --------
  async getFeatures(): Promise<{ plan: PlanInfo | null; features: FeatureMap; popup?: PopupConfig | null }> {
    const r = await this.http.get('/user/features');
    return r.data.data;
  }

  async getAccountStatus(): Promise<AccountStatus> {
    const r = await this.http.get('/user/account/status');
    return r.data.data;
  }

  async getPopup(code: string): Promise<PopupConfig | null> {
    try {
      const r = await this.http.get(`/user/popup/${code}`);
      return r.data.data;
    } catch {
      return null;
    }
  }

  async incrementUsage(featureCode: string, amount = 1) {
    const device_id = await secureStorage.getDeviceId();
    await this.http.post('/user/usage/increment', {
      feature_code: featureCode,
      amount,
      device_id,
    });
  }

  // raw http for custom calls
  request() {
    return this.http;
  }
}

// ============================================================
// SINGLETON HELPER
// ============================================================
let instance: LicenseClient | null = null;

export function initLicenseClient(opts: LicenseClientOptions) {
  instance = new LicenseClient(opts);
  return instance;
}

export function getLicenseClient(): LicenseClient {
  if (!instance) throw new Error('License client belum di-init. Panggil initLicenseClient() dulu.');
  return instance;
}
