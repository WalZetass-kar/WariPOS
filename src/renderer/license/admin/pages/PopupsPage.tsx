import React, { useCallback, useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import type { PopupRow} from '../api';
import { listPopups, updatePopup } from '../api';
import { Alert, Button, Field, Input, PageHeader, Textarea } from '../components';

export const PopupsPage: React.FC = () => {
  const [popups, setPopups] = useState<PopupRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setPopups(await listPopups()); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <div>
      <PageHeader
        title="Popup Settings"
        subtitle="Atur isi popup upgrade yang muncul di aplikasi user. Perubahan langsung berlaku di semua device."
      />
      {loading ? (
        <div className="text-slate-400 text-sm">Memuat…</div>
      ) : (
        <div className="space-y-4">
          {popups.map((p) => <PopupCard key={p.id} popup={p} onSaved={load} />)}
        </div>
      )}
    </div>
  );
};

const POPUP_LABELS: Record<string, { label: string; color: string; desc: string }> = {
  DEMO_LIMIT: { label: 'Demo Limit', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', desc: 'Muncul saat user demo melewati batas harian' },
  EXPIRED: { label: 'Expired', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', desc: 'Muncul saat lisensi tidak aktif' },
  FEATURE_LOCKED: { label: 'Fitur Terkunci', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400', desc: 'Muncul saat user klik fitur yang tidak ada di paket' },
};

const PopupCard: React.FC<{ popup: PopupRow; onSaved: () => void }> = ({ popup, onSaved }) => {
  const [form, setForm] = useState<PopupRow>(popup);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const meta = POPUP_LABELS[popup.code] || { label: popup.code, color: 'bg-slate-100 text-slate-600', desc: '' };

  async function save() {
    setSaving(true);
    try {
      await updatePopup(popup.id, {
        title: form.title, description: form.description ?? '',
        cta_text: form.cta_text ?? '', cta_url: form.cta_url ?? '',
        whatsapp_number: form.whatsapp_number ?? '', image_url: form.image_url ?? '',
        pricing_html: form.pricing_html ?? '', is_active: !!form.is_active,
      });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${meta.color}`}>{meta.label}</span>
          <div>
            <p className="font-semibold text-slate-800 dark:text-white text-sm">{form.title}</p>
            <p className="text-xs text-slate-400">{meta.desc}</p>
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-slate-500">Aktif</span>
          <div
            onClick={() => setForm({ ...form, is_active: form.is_active ? 0 : 1 })}
            className={`w-10 h-5 rounded-full transition-colors cursor-pointer relative ${form.is_active ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-700'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </div>
        </label>
      </div>

      {/* Fields */}
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Judul"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="CTA Text"><Input value={form.cta_text || ''} onChange={(e) => setForm({ ...form, cta_text: e.target.value })} /></Field>
        <Field label="CTA URL"><Input value={form.cta_url || ''} onChange={(e) => setForm({ ...form, cta_url: e.target.value })} placeholder="https://wa.me/628..." /></Field>
        <Field label="WhatsApp"><Input value={form.whatsapp_number || ''} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} placeholder="628123456789" /></Field>
        <Field label="Image URL" full><Input value={form.image_url || ''} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." /></Field>
        <Field label="Deskripsi" full><Textarea rows={2} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <Field label="Pricing HTML" full>
          <Textarea rows={3} className="font-mono text-xs" value={form.pricing_html || ''} onChange={(e) => setForm({ ...form, pricing_html: e.target.value })} placeholder="<ul><li>Basic Rp 99.000/bln</li></ul>" />
        </Field>
      </div>

      <div className="px-5 pb-5 flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          <Save className="w-4 h-4" />
          {saving ? 'Menyimpan…' : 'Simpan'}
        </Button>
        {saved && <span className="text-xs text-green-600 dark:text-green-400 font-medium"> Tersimpan</span>}
      </div>
    </div>
  );
};
