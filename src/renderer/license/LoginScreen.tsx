import React, { useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useLicense } from './FeatureContext';
import { useTheme } from '../contexts/ThemeContext';
import appLogo from '../assets/app-logo.png';

/**
 * Halaman login + register demo untuk client app.
 * Pakai komponen ini sebagai gate sebelum aplikasi POS utama dirender.
 *
 * Contoh:
 *  const { user, ready } = useLicense();
 *  if (!ready) return <Splash />;
 *  if (!user) return <LoginScreen />;
 *  return <App />;
 */
export const LoginScreen: React.FC = () => {
  const { login, register } = useLicense();
  const { mode, toggleMode } = useTheme();
  const [authMode, setAuthMode] = useState<'login' | 'demo'>('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      if (authMode === 'login') {
        await login(form.email, form.password);
      } else {
        if (form.password.length < 8) throw new Error('Password minimal 8 karakter');
        await register(form.name, form.email, form.password, form.phone);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Gagal masuk';
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 p-4 relative">
      {/* Theme Toggle Button */}
      <button 
        type="button"
        onClick={toggleMode}
        className="absolute top-4 right-4 z-50 p-2.5 rounded-xl bg-white/10 border border-white/10 text-white/70 hover:text-white hover:bg-white/20 transition-all shadow-lg backdrop-blur-sm"
        title={mode === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
      >
        {mode === 'light' ? <Moon size={20} /> : <Sun size={20} />}
      </button>

      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 dark:border dark:border-slate-800 shadow-2xl p-8">
        <div className="text-center mb-6">
          <img src={appLogo} alt="WariPOS" className="mx-auto mb-2 h-14 w-14 rounded-2xl object-cover shadow" />
          <h1 className="text-2xl font-bold dark:text-white">WariPOS</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">Masuk untuk mulai berjualan</p>
        </div>

        <div className="flex bg-gray-100 dark:bg-slate-800 rounded-lg p-1 mb-4 text-sm">
          <button
            type="button"
            onClick={() => setAuthMode('login')}
            className={`flex-1 py-1.5 rounded-md transition-all ${
              authMode === 'login' ? 'bg-white dark:bg-slate-700 dark:text-white shadow font-medium' : 'text-gray-500 dark:text-slate-400'
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setAuthMode('demo')}
            className={`flex-1 py-1.5 rounded-md transition-all ${
              authMode === 'demo' ? 'bg-white dark:bg-slate-700 dark:text-white shadow font-medium' : 'text-gray-500 dark:text-slate-400'
            }`}
          >
            Daftar Demo
          </button>
        </div>

        {err && <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-2 rounded mb-3 border border-red-100 dark:border-red-900/30">{err}</div>}

        <form onSubmit={submit} className="space-y-3">
          {authMode === 'demo' && (
            <>
              <Field label="Nama / Toko">
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
                />
              </Field>
              <Field label="No. WhatsApp (opsional)">
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full border dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
                />
              </Field>
            </>
          )}
          <Field label="Email">
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full border dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
            />
          </Field>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium shadow-lg shadow-indigo-500/20 transition-all"
          >
            {loading ? 'Memproses…' : authMode === 'login' ? 'Masuk' : 'Daftar Demo (14 hari)'}
          </button>
        </form>

        <p className="mt-4 text-xs text-center text-gray-400 dark:text-slate-500">
          {authMode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}{' '}
          <button
            onClick={() => setAuthMode(authMode === 'login' ? 'demo' : 'login')}
            className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
          >
            {authMode === 'login' ? 'Daftar demo gratis' : 'Login di sini'}
          </button>
        </p>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">{label}</label>
    {children}
  </div>
);
