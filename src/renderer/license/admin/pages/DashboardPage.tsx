import React, { useEffect, useState } from 'react';
import { Users, CreditCard, DollarSign, Puzzle, TrendingUp, Activity } from 'lucide-react';
import { listUsers, listPayments, listPlans } from '../api';
import { StatCard } from '../components';

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState({ users: 0, active: 0, expired: 0, payments: 0, plans: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [users, payments, plans] = await Promise.all([listUsers(), listPayments(), listPlans()]);
        setStats({
          users: users.length,
          active: users.filter((u) => u.sub_status === 'active').length,
          expired: users.filter((u) => u.sub_status === 'expired').length,
          payments: payments.length,
          plans: plans.length,
        });
      } finally { setLoading(false); }
    })();
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800 dark:text-white">Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Ringkasan sistem lisensi WariPOS</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <StatCard label="Total User" value={stats.users} icon={Users} loading={loading} />
        <StatCard label="Aktif" value={stats.active} icon={TrendingUp} color="text-green-600 dark:text-green-400" loading={loading} />
        <StatCard label="Expired" value={stats.expired} icon={Activity} color="text-orange-600 dark:text-orange-400" loading={loading} />
        <StatCard label="Total Plan" value={stats.plans} icon={CreditCard} color="text-primary-600 dark:text-primary-400" loading={loading} />
        <StatCard label="Persetujuan Lisensi" value={stats.payments} icon={DollarSign} color="text-pink-600 dark:text-pink-400" loading={loading} />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Puzzle className="w-4 h-4 text-primary-500" />
          <h2 className="font-semibold text-slate-800 dark:text-white">Cara Pakai</h2>
        </div>
        <ol className="space-y-2">
          {[
            ['Plans', 'Atur fitur tiap paket (FREE / BASIC / PRO / ENTERPRISE).'],
            ['Users', 'Buat akun pembeli setelah mereka membayar, atau ubah paket kapan saja.'],
            ['Popup', 'Atur isi popup upgrade yang muncul di aplikasi user.'],
            ['Persetujuan Lisensi', 'Setujui request dari popup lisensi; status success mengaktifkan lisensi.'],
            ['Fitur', 'Kelola master daftar fitur yang dipakai di aplikasi.'],
          ].map(([tab, desc], i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              <span className="text-slate-600 dark:text-slate-400">Tab <b className="text-slate-800 dark:text-slate-200">{tab}</b> — {desc}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};
