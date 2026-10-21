import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Trash2 } from 'lucide-react';
import type { AdminPlanRow, PlanFeatureRow} from '../api';
import { deletePlan, getPlanFeatures, listPlans, setPlanFeatures, updatePlan } from '../api';
import { Button, Modal, PageHeader } from '../components';

export const PlansPage: React.FC = () => {
  const [plans, setPlans] = useState<AdminPlanRow[]>([]);
  const [editing, setEditing] = useState<AdminPlanRow | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<AdminPlanRow | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setPlans(await listPlans()); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const PLAN_COLORS: Record<string, string> = {
    DEMO: 'from-slate-500 to-slate-400',
    BASIC: 'from-blue-500 to-blue-400',
    PRO: 'from-primary-600 to-primary-400',
    ENTERPRISE: 'from-violet-600 to-purple-400',
  };

  async function removePlan(plan: AdminPlanRow) {
    setDeletingId(plan.id);
    setDeleteError('');
    try {
      await deletePlan(plan.id);
      setConfirmingDelete(null);
      await load();
    } catch (error: any) {
      setDeleteError(error?.response?.data?.message || error?.message || 'Gagal menghapus paket');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <PageHeader title="Plans" subtitle="Atur fitur yang tersedia di setiap paket lisensi" />
      {loading ? (
        <div className="text-slate-400 text-sm">Memuat…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((p) => {
            const gradient = PLAN_COLORS[p.code] || 'from-slate-500 to-slate-400';
            return (
              <div key={p.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
                <div className={`bg-gradient-to-br ${gradient} p-5`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">{p.code}</p>
                      <h3 className="text-white text-xl font-bold">{p.name}</h3>
                    </div>
                    <button
                      onClick={async () => { await updatePlan(p.id, { is_active: !p.is_active }); load(); }}
                      className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${p.is_active ? 'bg-white/20 text-white' : 'bg-black/20 text-white/60'}`}
                    >
                      {p.is_active ? 'Aktif' : 'Off'}
                    </button>
                  </div>
                  <p className="text-white text-2xl font-bold">
                    {p.price === 0 ? 'Gratis' : `Rp ${Number(p.price).toLocaleString('id-ID')}`}
                  </p>
                  <p className="text-white/70 text-xs mt-0.5">{p.duration_days === 0 ? 'Seumur hidup' : `${p.duration_days} hari`}</p>
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 flex-1">{p.description || '—'}</p>
	                  <div className="grid grid-cols-2 gap-2">
	                    <Button onClick={() => setEditing(p)} className="w-full">Atur Fitur</Button>
	                    <Button variant="danger" onClick={() => { setConfirmingDelete(p); setDeleteError(''); }} disabled={deletingId === p.id} className="w-full">
	                      <Trash2 className="w-4 h-4" />
	                      {deletingId === p.id ? '...' : 'Hapus'}
	                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {confirmingDelete && (
        <Modal title="Hapus Paket" onClose={() => { if (!deletingId) setConfirmingDelete(null); }}>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 dark:text-white">{confirmingDelete.name}</p>
                <p className="mt-1 font-mono text-xs text-slate-400">{confirmingDelete.code}</p>
              </div>
            </div>
            <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              Paket yang sudah dipakai pembeli, subscription, atau pembayaran tidak bisa dihapus. Nonaktifkan paket kalau hanya ingin disembunyikan dari pembelian baru.
            </div>
            {deleteError && (
              <div className="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-300">
                {deleteError}
              </div>
            )}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Button variant="secondary" onClick={() => setConfirmingDelete(null)} disabled={deletingId === confirmingDelete.id}>Batal</Button>
              <Button variant="danger" onClick={() => void removePlan(confirmingDelete)} disabled={deletingId === confirmingDelete.id}>
                <Trash2 className="w-4 h-4" />
                {deletingId === confirmingDelete.id ? 'Menghapus...' : 'Hapus'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {editing && <PlanFeaturesModal plan={editing} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
};

const PlanFeaturesModal: React.FC<{ plan: AdminPlanRow; onClose: () => void; onSaved: () => void }> = ({ plan, onClose, onSaved }) => {
  const [features, setFeatures] = useState<PlanFeatureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPlanFeatures(plan.id).then((rows) => { setFeatures(rows); setLoading(false); });
  }, [plan.id]);

  function toggle(code: string) {
    setFeatures((arr) => arr.map((f) => f.code === code ? { ...f, is_enabled: f.is_enabled ? 0 : 1 } : f));
  }
  function setLimit(code: string, val: string) {
    setFeatures((arr) => arr.map((f) => f.code === code ? { ...f, limit_value: val === '' ? null : Number(val) } : f));
  }

  async function save() {
    setSaving(true);
    try {
      await setPlanFeatures(plan.id, features.map((f) => ({ code: f.code, enabled: !!f.is_enabled, limit: f.limit_value })));
      onSaved(); onClose();
    } finally { setSaving(false); }
  }

  const grouped = features.reduce<Record<string, PlanFeatureRow[]>>((acc, f) => {
    const k = f.category || 'lainnya';
    (acc[k] = acc[k] || []).push(f);
    return acc;
  }, {});

  return (
    <Modal title={`Fitur — ${plan.name}`} onClose={onClose} wide>
      {loading ? (
        <div className="text-slate-400 text-sm py-4">Memuat fitur…</div>
      ) : (
        <>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Centang fitur yang aktif. Isi <b>Limit</b> untuk batasi per hari (kosong = unlimited).
          </p>
          <div className="max-h-[55vh] overflow-auto pr-1 space-y-5">
            {Object.entries(grouped).map(([cat, list]) => (
              <div key={cat}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 px-1">{cat}</p>
                <div className="space-y-1">
                  {list.map((f) => (
                    <div key={f.code} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${f.is_enabled ? 'bg-primary-50 dark:bg-primary-900/20' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
                      <button
                        type="button"
                        onClick={() => toggle(f.code)}
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${f.is_enabled ? 'bg-primary-600 border-primary-600' : 'border-slate-300 dark:border-slate-600'}`}
                      >
                        {f.is_enabled ? <Check className="w-3 h-3 text-white" /> : null}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{f.name}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{f.code}</p>
                      </div>
                      <input
                        type="number"
                        placeholder="∞"
                        value={f.limit_value ?? ''}
                        onChange={(e) => setLimit(f.code, e.target.value)}
                        className="w-24 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-center bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
            <Button variant="secondary" onClick={onClose}>Batal</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</Button>
          </div>
        </>
      )}
    </Modal>
  );
};
