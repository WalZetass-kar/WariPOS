import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Copy, KeyRound, Plus, RefreshCw, RotateCcw, Trash2, UserX } from 'lucide-react';
import type {
  AdminUserRow, AdminPlanRow} from '../api';
import {
  changeUserPlan, createUser, deleteUser, listPlans, listUsers, resetUserPassword, updateUser,
} from '../api';
import { Alert, Badge, Button, Field, Input, Modal, PageHeader, Select, Table, Td, Th } from '../components';

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editPlan, setEditPlan] = useState<AdminUserRow | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'suspended' | 'delete'; user: AdminUserRow } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [resetLoadingId, setResetLoadingId] = useState<number | null>(null);
  const [resetPasswordResult, setResetPasswordResult] = useState<{ user: AdminUserRow; password: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try { setUsers(await listUsers(search)); }
    catch (e: any) { setErr(e?.response?.data?.message || e?.message || 'Gagal memuat'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { void load(); }, [load]);

  function subStatusColor(s: string | null): 'green' | 'orange' | 'red' | 'gray' {
    if (s === 'active') return 'green';
    if (s === 'expired') return 'orange';
    if (s === 'suspended') return 'red';
    return 'gray';
  }

  async function runConfirmAction() {
    if (!confirmAction) return;
    setConfirmLoading(true);
    try {
      if (confirmAction.type === 'delete') await deleteUser(confirmAction.user.id);
      else await updateUser(confirmAction.user.id, { status: 'suspended' });
      setConfirmAction(null);
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || 'Aksi gagal diproses');
    } finally {
      setConfirmLoading(false);
    }
  }

  async function resetPassword(user: AdminUserRow) {
    setResetLoadingId(user.id);
    setErr(null);
    try {
      const r = await resetUserPassword(user.id);
      setResetPasswordResult({ user, password: r.new_password });
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || 'Gagal reset password');
    } finally {
      setResetLoadingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Kelola akun pembeli dan paket lisensi mereka"
        action={
          <div className="flex gap-2">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama / email…" className="w-56" />
            <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" />Buat Akun</Button>
          </div>
        }
      />

      {err && <div className="mb-4"><Alert>{err}</Alert></div>}

      <Table>
        <thead>
          <tr>
            <Th>Nama</Th><Th>Email</Th><Th>Paket</Th><Th>Status</Th><Th>Berakhir</Th><Th>Device</Th><Th></Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {loading ? (
            <tr><td colSpan={7} className="text-center py-12 text-slate-400 text-sm">Memuat…</td></tr>
          ) : users.length === 0 ? (
            <tr><td colSpan={7} className="text-center py-12 text-slate-400 text-sm">Belum ada user</td></tr>
          ) : users.map((u) => (
            <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <Td><span className="font-medium text-slate-800 dark:text-white">{u.name}</span></Td>
              <Td><span className="text-slate-500">{u.email}</span></Td>
              <Td><Badge color="indigo">{u.plan_code || '—'}</Badge></Td>
              <Td><Badge color={subStatusColor(u.sub_status)}>{u.sub_status || u.status}</Badge></Td>
              <Td><span className="text-xs text-slate-500">{u.expired_at ? new Date(u.expired_at).toLocaleDateString('id-ID') : '—'}</span></Td>
              <Td><span className="text-xs font-mono text-slate-500">{u.active_devices || 0}</span></Td>
              <Td>
                <div className="flex items-center gap-1 justify-end">
                  <Button size="sm" variant="secondary" onClick={() => setEditPlan(u)}>Ubah Paket</Button>
                  <Button size="sm" variant="secondary" disabled={resetLoadingId === u.id} onClick={() => void resetPassword(u)}><RotateCcw className={`w-3 h-3 ${resetLoadingId === u.id ? 'animate-spin' : ''}`} /></Button>
                  <Button size="sm" variant="secondary" onClick={() => setConfirmAction({ type: 'suspended', user: u })}><UserX className="w-3 h-3" /></Button>
                  <Button size="sm" variant="danger" onClick={() => setConfirmAction({ type: 'delete', user: u })}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onSaved={load} />}
      {editPlan && <ChangePlanModal user={editPlan} onClose={() => setEditPlan(null)} onSaved={load} />}
      {resetPasswordResult && (
        <ResetPasswordResultModal
          user={resetPasswordResult.user}
          password={resetPasswordResult.password}
          onClose={() => setResetPasswordResult(null)}
        />
      )}
      {confirmAction && (
        <Modal title={confirmAction.type === 'delete' ? 'Hapus User' : 'Suspend User'} onClose={() => { if (!confirmLoading) setConfirmAction(null); }}>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${confirmAction.type === 'delete' ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'}`}>
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 dark:text-white">{confirmAction.user.name}</p>
                <p className="mt-1 text-xs text-slate-400">{confirmAction.user.email}</p>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/70">
              <div className="flex justify-between gap-3"><span className="text-slate-500">Paket</span><span className="font-semibold text-slate-800 dark:text-slate-100">{confirmAction.user.plan_code || '-'}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-500">Device</span><span className="font-semibold text-slate-800 dark:text-slate-100">{confirmAction.user.active_devices || 0}</span></div>
            </div>
            <div className={`rounded-xl border px-3 py-2 text-sm ${confirmAction.type === 'delete' ? 'border-red-100 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300' : 'border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300'}`}>
              {confirmAction.type === 'delete'
                ? 'User akan dihapus permanen dari license server.'
                : 'User akan disuspend dan device aktif tidak bisa dipakai sampai diaktifkan lagi.'}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Button variant="secondary" onClick={() => setConfirmAction(null)} disabled={confirmLoading}>Batal</Button>
              <Button variant={confirmAction.type === 'delete' ? 'danger' : 'primary'} onClick={() => void runConfirmAction()} disabled={confirmLoading}>
                {confirmLoading ? 'Memproses...' : confirmAction.type === 'delete' ? 'Hapus' : 'Suspend'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

const ResetPasswordResultModal: React.FC<{ user: AdminUserRow; password: string; onClose: () => void }> = ({ user, password, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');

  async function copyPassword() {
    setCopyError('');
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyError('Gagal menyalin password');
    }
  }

  return (
    <Modal title="Password Pembeli Di-reset" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-300">
            <KeyRound className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 dark:text-white">{user.name}</p>
            <p className="mt-1 text-xs text-slate-400">{user.email}</p>
          </div>
        </div>
        <Alert kind="success">Berikan password ini ke pembeli. Password hanya tampil di sini setelah reset berhasil.</Alert>
        {copyError && <Alert>{copyError}</Alert>}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">Password Baru</label>
          <div className="flex gap-2">
            <Input readOnly value={password} className="font-mono font-semibold" />
            <Button type="button" onClick={copyPassword}>
              {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Tersalin' : 'Salin'}
            </Button>
          </div>
        </div>
        <div className="flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose}>Tutup</Button>
        </div>
      </div>
    </Modal>
  );
};

const CreateUserModal: React.FC<{ onClose: () => void; onSaved: () => void }> = ({ onClose, onSaved }) => {
  const [plans, setPlans] = useState<AdminPlanRow[]>([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', plan_code: 'BASIC', duration_days: 30 });
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => { listPlans().then(setPlans); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setLoading(true);
    try { await createUser({ ...form, duration_days: Number(form.duration_days) }); onSaved(); onClose(); }
    catch (e: any) { setErr(e?.response?.data?.message || e?.message || 'Gagal'); }
    finally { setLoading(false); }
  }

  return (
    <Modal title="Buat Akun Pembeli" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {err && <Alert>{err}</Alert>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nama / Toko" full><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email"><Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Password (min 8)"><Input required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          <Field label="WhatsApp (opsional)"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Paket">
            <Select value={form.plan_code} onChange={(e) => setForm({ ...form, plan_code: e.target.value })}>
              {plans.map((p) => <option key={p.code} value={p.code}>{p.name} — Rp {Number(p.price).toLocaleString('id-ID')}</option>)}
            </Select>
          </Field>
          <Field label="Durasi (hari)"><Input type="number" value={form.duration_days} onChange={(e) => setForm({ ...form, duration_days: Number(e.target.value) || 30 })} /></Field>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Menyimpan…' : 'Simpan'}</Button>
        </div>
      </form>
    </Modal>
  );
};

const ChangePlanModal: React.FC<{ user: AdminUserRow; onClose: () => void; onSaved: () => void }> = ({ user, onClose, onSaved }) => {
  const [plans, setPlans] = useState<AdminPlanRow[]>([]);
  const [planCode, setPlanCode] = useState(user.plan_code || 'BASIC');
  const [days, setDays] = useState(30);
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => { listPlans().then(setPlans); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setLoading(true);
    try { await changeUserPlan(user.id, { plan_code: planCode, duration_days: Number(days), notes }); onSaved(); onClose(); }
    catch (e: any) { setErr(e?.response?.data?.message || e?.message || 'Gagal'); }
    finally { setLoading(false); }
  }

  return (
    <Modal title={`Ubah Paket — ${user.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {err && <Alert>{err}</Alert>}
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800 px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
          Paket sekarang: <b className="text-slate-800 dark:text-white">{user.plan_code || '—'}</b>
          {user.expired_at && <> · berakhir {new Date(user.expired_at).toLocaleDateString('id-ID')}</>}
        </div>
        <Field label="Paket baru">
          <Select value={planCode} onChange={(e) => setPlanCode(e.target.value)}>
            {plans.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="Durasi (hari)"><Input type="number" value={days} onChange={(e) => setDays(Number(e.target.value) || 30)} /></Field>
        <Field label="Catatan"><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Menyimpan…' : 'Simpan'}</Button>
        </div>
      </form>
    </Modal>
  );
};
