import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Plus, CheckCircle, Trash2 } from 'lucide-react';
import type {
  AdminPlanRow, AdminUserRow, PaymentRow} from '../api';
import {
  approvePayment, createPayment, deletePayment, listPayments, listPlans, listUsers,
} from '../api';
import { Alert, Badge, Button, Field, Input, Modal, PageHeader, Select, Table, Td, Th } from '../components';

export const PaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<PaymentRow | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setPayments(await listPayments()); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function removePayment(payment: PaymentRow) {
    setDeletingId(payment.id);
    setDeleteError('');
    try {
      await deletePayment(payment.id);
      setConfirmingDelete(null);
      await load();
    } catch (error: any) {
      setDeleteError(error?.response?.data?.message || error?.message || 'Gagal menghapus pembayaran');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Persetujuan Lisensi"
        subtitle="Setujui request dari popup lisensi. Status success mengaktifkan lisensi user."
        action={<Button onClick={() => setShowAdd(true)}><Plus className="w-4 h-4" />Catat Persetujuan</Button>}
      />
      <Table>
        <thead>
          <tr><Th>User</Th><Th>Paket</Th><Th>Jumlah</Th><Th>Metode</Th><Th>Status</Th><Th>Tanggal</Th><Th></Th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {loading ? (
            <tr><td colSpan={7} className="text-center py-12 text-slate-400 text-sm">Memuat…</td></tr>
          ) : payments.length === 0 ? (
            <tr><td colSpan={7} className="text-center py-12 text-slate-400 text-sm">Belum ada persetujuan lisensi</td></tr>
          ) : payments.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <Td>
                <p className="font-medium text-slate-800 dark:text-white">{p.user_name}</p>
                <p className="text-xs text-slate-400">{p.user_email}</p>
              </Td>
              <Td><Badge color="indigo">{p.plan_code || '—'}</Badge></Td>
              <Td><span className="font-medium">Rp {Number(p.amount).toLocaleString('id-ID')}</span></Td>
              <Td><span className="text-slate-500 text-xs">{p.method}</span></Td>
              <Td>
                <Badge color={p.status === 'success' ? 'green' : p.status === 'pending' ? 'yellow' : 'red'}>
                  {p.status}
                </Badge>
              </Td>
              <Td><span className="text-xs text-slate-400">{new Date(p.created_at).toLocaleString('id-ID')}</span></Td>
              <Td>
                <div className="flex justify-end gap-1">
                  {p.status === 'pending' && (
                    <Button size="sm" onClick={async () => { await approvePayment(p.id); load(); }}>
                      <CheckCircle className="w-3 h-3" />Setujui
                    </Button>
                  )}
                  <Button size="sm" variant="danger" onClick={() => { setConfirmingDelete(p); setDeleteError(''); }} disabled={deletingId === p.id}>
                    <Trash2 className="w-3 h-3" />Hapus
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {showAdd && <AddPaymentModal onClose={() => setShowAdd(false)} onSaved={load} />}
      {confirmingDelete && (
        <Modal title="Hapus Persetujuan Lisensi" onClose={() => { if (!deletingId) setConfirmingDelete(null); }}>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 dark:text-white">{confirmingDelete.user_name}</p>
                <p className="mt-1 text-xs text-slate-400">{confirmingDelete.user_email}</p>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/70">
              <div className="flex justify-between gap-3"><span className="text-slate-500">Paket</span><span className="font-semibold text-slate-800 dark:text-slate-100">{confirmingDelete.plan_code || '-'}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-500">Jumlah</span><span className="font-semibold text-slate-800 dark:text-slate-100">Rp {Number(confirmingDelete.amount).toLocaleString('id-ID')}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-500">Status</span><span className="font-semibold text-slate-800 dark:text-slate-100">{confirmingDelete.status}</span></div>
            </div>
            <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              Menghapus pembayaran tidak membatalkan subscription yang sudah pernah dibuat dari pembayaran ini.
            </div>
            {deleteError && <Alert>{deleteError}</Alert>}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Button variant="secondary" onClick={() => setConfirmingDelete(null)} disabled={deletingId === confirmingDelete.id}>Batal</Button>
              <Button variant="danger" onClick={() => void removePayment(confirmingDelete)} disabled={deletingId === confirmingDelete.id}>
                <Trash2 className="w-4 h-4" />
                {deletingId === confirmingDelete.id ? 'Menghapus...' : 'Hapus'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

const AddPaymentModal: React.FC<{ onClose: () => void; onSaved: () => void }> = ({ onClose, onSaved }) => {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [plans, setPlans] = useState<AdminPlanRow[]>([]);
  const [form, setForm] = useState({ user_id: '', plan_code: 'BASIC', amount: 99000, method: 'manual_transfer', status: 'success' as 'success' | 'pending', notes: '' });
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listUsers().then(setUsers);
    listPlans().then(setPlans);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.user_id) return setErr('User wajib dipilih');
    setErr(null); setLoading(true);
    try {
      await createPayment({ user_id: Number(form.user_id), plan_code: form.plan_code, amount: Number(form.amount), method: form.method, status: form.status, notes: form.notes });
      onSaved(); onClose();
    } catch (e: any) { setErr(e?.response?.data?.message || e?.message || 'Gagal'); }
    finally { setLoading(false); }
  }

  return (
    <Modal title="Catat Persetujuan Lisensi" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {err && <Alert>{err}</Alert>}
        <Field label="User">
          <Select required value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })}>
            <option value="">— pilih user —</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name} — {u.email}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Paket">
            <Select value={form.plan_code} onChange={(e) => {
              const plan = plans.find((p) => p.code === e.target.value);
              setForm({ ...form, plan_code: e.target.value, amount: plan ? Number(plan.price) : form.amount });
            }}>
              {plans.map((p) => <option key={p.code} value={p.code}>{p.name} — Rp {Number(p.price).toLocaleString('id-ID')}</option>)}
            </Select>
          </Field>
          <Field label="Jumlah (Rp)"><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></Field>
          <Field label="Metode"><Input value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} /></Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'success' | 'pending' })}>
              <option value="success">success (auto perpanjang)</option>
              <option value="pending">pending (butuh approve)</option>
            </Select>
          </Field>
        </div>
        <Field label="Catatan"><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Menyimpan…' : 'Simpan'}</Button>
        </div>
      </form>
    </Modal>
  );
};
