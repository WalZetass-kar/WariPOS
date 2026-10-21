import React, { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import type { AdminFeatureRow} from '../api';
import { createFeature, listFeatures, updateFeature } from '../api';
import { Alert, Badge, Button, Field, Input, Modal, PageHeader, Select, Table, Td, Th } from '../components';

export const FeaturesPage: React.FC = () => {
  const [features, setFeatures] = useState<AdminFeatureRow[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setFeatures(await listFeatures()); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const catColor: Record<string, 'indigo' | 'green' | 'blue' | 'orange'> = {
    core: 'indigo', finance: 'green', report: 'blue', tools: 'orange',
  };

  return (
    <div>
      <PageHeader
        title="Master Fitur"
        subtitle="Daftar semua fitur yang bisa diaktifkan per paket"
        action={<Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" />Tambah Fitur</Button>}
      />
      <Table>
        <thead>
          <tr><Th>Kode</Th><Th>Nama</Th><Th>Kategori</Th><Th>Status</Th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {loading ? (
            <tr><td colSpan={4} className="text-center py-12 text-slate-400 text-sm">Memuat…</td></tr>
          ) : features.map((f) => (
            <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <Td><code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg text-slate-600 dark:text-slate-400">{f.code}</code></Td>
              <Td><span className="font-medium text-slate-800 dark:text-white">{f.name}</span></Td>
              <Td><Badge color={catColor[f.category || ''] || 'gray'}>{f.category || '—'}</Badge></Td>
              <Td>
                <button onClick={async () => { await updateFeature(f.id, { is_active: !f.is_active }); load(); }}>
                  <Badge color={f.is_active ? 'green' : 'gray'}>{f.is_active ? 'Aktif' : 'Nonaktif'}</Badge>
                </button>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {showCreate && <CreateFeatureModal onClose={() => setShowCreate(false)} onSaved={load} />}
    </div>
  );
};

const CreateFeatureModal: React.FC<{ onClose: () => void; onSaved: () => void }> = ({ onClose, onSaved }) => {
  const [form, setForm] = useState({ code: '', name: '', category: 'core', sort_order: 0 });
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setLoading(true);
    try { await createFeature({ ...form, sort_order: Number(form.sort_order) }); onSaved(); onClose(); }
    catch (e: any) { setErr(e?.response?.data?.message || e?.message || 'Gagal'); }
    finally { setLoading(false); }
  }

  return (
    <Modal title="Tambah Fitur Baru" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {err && <Alert>{err}</Alert>}
        <Field label="Kode (snake_case)">
          <Input required pattern="[a-z0-9_]+" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="contoh: multi_warehouse" />
        </Field>
        <Field label="Nama"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kategori">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="core">core</option>
              <option value="finance">finance</option>
              <option value="report">report</option>
              <option value="tools">tools</option>
            </Select>
          </Field>
          <Field label="Sort order"><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></Field>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Menyimpan…' : 'Simpan'}</Button>
        </div>
      </form>
    </Modal>
  );
};
