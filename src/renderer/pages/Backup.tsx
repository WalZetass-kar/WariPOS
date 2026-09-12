import { useState, useEffect } from "react";
import {
  Database,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  Clock,
  HardDrive,
  Plus,
} from "lucide-react";
import Card from "../components/Card";
import Button from "../components/Button";
import Modal from "../components/Modal";
import { SkeletonCard } from "../components/Skeleton";
import { api } from "../utils/api";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../contexts/AuthContext";
import { useDemoGuard } from "../hooks/useDemoGuard";
import type { Backup } from "../../shared/types";
import { estimateStorageUsage } from "../utils/sqlitePersistence";
import { ensureStoragePermission } from "../utils/nativePermissions";

const fmt = (bytes: number | null) => {
  if (!bytes) return "0 B";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${["B", "KB", "MB", "GB"][i]}`;
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function BackupPage() {
  const toast = useToast();
  const { user } = useAuth();
  const { guardPremiumFeature } = useDemoGuard();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Backup | null>(null);
  const [modal, setModal] = useState<"restore" | "delete" | "import" | null>(
    null,
  );
  const [actionLoading, setActionLoading] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [storageUsage, setStorageUsage] = useState({ usage: 0, quota: 0, percent: 0 });

  const load = async () => {
    setLoading(true);
    const r = await api<Backup[]>("backup:getAll");
    if (r.success) setBackups(r.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    estimateStorageUsage().then(setStorageUsage).catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (guardPremiumFeature('backup_restore', 'Backup Database')) return;
    const permission = await ensureStoragePermission();
    if (!permission.granted) return toast(permission.message ?? "Izin penyimpanan ditolak", "error");
    setCreating(true);
    toast("Membuat backup...", "info");
    const r = await api(
      "backup:create",
      user?.nama_pengguna ?? "system",
      "Manual backup",
    );
    setCreating(false);
    if (r.success) {
      toast("Backup berhasil dibuat");
      load();
    } else toast(r.message as string, "error");
  };

  const handleRestore = async () => {
    if (!selected) return;
    if (guardPremiumFeature('backup_restore', 'Restore Database')) return;
    setActionLoading(true);
    toast("Merestore database...", "info");
    const r = await api("backup:restore", selected.kd_backup);
    setActionLoading(false);
    if (r.success) {
      toast("Restore berhasil. Aplikasi akan restart...");
      setModal(null);
      setTimeout(() => window.location.reload(), 1500);
    } else toast(r.message as string, "error");
  };

  const handleDelete = async () => {
    if (!selected) return;
    setActionLoading(true);
    const r = await api("backup:delete", selected.kd_backup);
    setActionLoading(false);
    if (r.success) {
      toast("Backup dihapus");
      setModal(null);
      load();
    } else toast(r.message as string, "error");
  };

  const handleDownload = async (b: Backup) => {
    const permission = await ensureStoragePermission();
    if (!permission.granted) return toast(permission.message ?? "Izin penyimpanan ditolak", "error");
    const r = await api<{ path: string }>("backup:download", b.kd_backup);
    if (r.success) toast(`File tersimpan di: ${r.data?.path}`);
    else toast(r.message as string, "error");
  };

  const handleImport = async () => {
    if (!importFile) return toast("Pilih file backup", "error");
    if (guardPremiumFeature('backup_restore', 'Import Database')) return;
    const permission = await ensureStoragePermission();
    if (!permission.granted) return toast(permission.message ?? "Izin penyimpanan ditolak", "error");

    // Validate SQLite header before importing
    const headerSlice = importFile.slice(0, 16);
    const headerBuffer = await headerSlice.arrayBuffer();
    const headerBytes = new Uint8Array(headerBuffer);
    const SQLITE_HEADER = [83, 81, 76, 105, 116, 101, 32, 102, 111, 114, 109, 97, 116, 32, 51, 0]; // "SQLite format 3\0"
    const isValidSqlite = SQLITE_HEADER.every((byte, i) => headerBytes[i] === byte);
    if (!isValidSqlite) {
      return toast("File bukan database SQLite yang valid. Pastikan file backup tidak corrupt.", "error");
    }

    // Read file as base64
    const reader = new FileReader();
    reader.onload = async () => {
      setActionLoading(true);
      const base64 = (reader.result as string).split(",")[1];
      const r = await api("backup:import", base64, importFile.name);
      setActionLoading(false);

      if (r.success) {
        toast("Import berhasil. Aplikasi akan restart...");
        setModal(null);
        setImportFile(null);
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast(r.message as string, "error");
      }
    };
    reader.readAsDataURL(importFile);
  };

  const totalSize = backups.reduce((s, b) => s + (b.ukuran ?? 0), 0);
  const latest = backups[0];

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      {storageUsage.percent >= 80 && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
          <div className="flex items-start gap-3">
            <HardDrive className="mt-0.5 text-amber-500" size={20} />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-200">Storage hampir penuh</p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Penggunaan penyimpanan sekitar {storageUsage.percent}%. Buat backup, hapus data lama, atau kosongkan file yang tidak diperlukan.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <Card className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary-500 flex items-center justify-center text-white shrink-0 shadow-lg">
                <Database size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Total Backup
                </p>
                <p className="text-2xl font-bold text-slate-800 dark:text-white">
                  {backups.length}
                </p>
              </div>
            </Card>
            <Card className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shrink-0 shadow-lg">
                <HardDrive size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Total Ukuran
                </p>
                <p className="text-2xl font-bold text-slate-800 dark:text-white">
                  {fmt(totalSize)}
                </p>
              </div>
            </Card>
            <Card className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-pink-500 flex items-center justify-center text-white shrink-0 shadow-lg">
                <Clock size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Backup Terakhir
                </p>
                <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
                  {latest ? fmtDate(latest.tgl_backup) : "Belum ada"}
                </p>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Backup List */}
      <Card
        title="Riwayat Backup Database"
        action={
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Button
              variant="secondary"
              icon={<RefreshCw size={14} />}
              onClick={load}
              className="text-xs px-3 py-2 font-bold rounded-xl border border-slate-200 dark:border-slate-700"
            >
              Refresh
            </Button>
            <Button
              variant="secondary"
              icon={<Upload size={14} />}
              onClick={() => setModal("import")}
              className="text-xs px-3 py-2 font-bold rounded-xl border border-slate-200 dark:border-slate-700"
            >
              Import
            </Button>
            <Button
              icon={<Plus size={14} />}
              onClick={handleCreate}
              loading={creating}
              className="text-xs px-3.5 py-2 font-bold bg-primary-600 hover:bg-primary-700 text-white rounded-xl shadow-sm"
            >
              Buat Backup Baru
            </Button>
          </div>
        }
      >
        {loading ? (
          <div className="py-10 text-center text-slate-400">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
            Memuat...
          </div>
        ) : backups.length === 0 ? (
          <div className="py-12 text-center">
            <Database
              size={40}
              className="mx-auto mb-3 text-slate-300 dark:text-slate-600"
            />
            <p className="text-slate-500 font-medium">Belum ada backup</p>
            <p className="text-sm text-slate-400 mt-1">
              Klik "Buat Backup" untuk membuat backup pertama
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {backups.map((b) => (
              <div
                key={b.kd_backup}
                className="p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 shadow-xs hover:border-primary-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                {/* File Information */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <Database size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-mono font-bold text-slate-800 dark:text-slate-100 break-all leading-snug">
                      {b.nama_file}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1 shrink-0">
                        <Clock size={12} className="text-slate-400" />
                        <span>{fmtDate(b.tgl_backup)}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 shrink-0">
                        <HardDrive size={12} className="text-slate-400" />
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{fmt(b.ukuran)}</span>
                      </span>
                      {b.username && (
                        <span className="shrink-0 text-slate-400">
                          oleh <span className="font-medium text-slate-600 dark:text-slate-300">{b.username}</span>
                        </span>
                      )}
                    </div>
                    {b.keterangan && (
                      <p className="text-[11px] sm:text-xs text-slate-400 mt-1 break-words">
                        {b.keterangan}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1.5 pt-2.5 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDownload(b)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors active:scale-95"
                    title="Download File Backup"
                  >
                    <Download size={14} />
                    <span>Unduh</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(b);
                      setModal("restore");
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-100 text-xs font-semibold transition-colors active:scale-95"
                    title="Restore Database"
                  >
                    <Upload size={14} />
                    <span>Restore</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(b);
                      setModal("delete");
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 hover:bg-red-100 text-xs font-semibold transition-colors active:scale-95"
                    title="Hapus File Backup"
                  >
                    <Trash2 size={14} />
                    <span>Hapus</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Restore Modal */}
      <Modal
        open={modal === "restore"}
        onClose={() => setModal(null)}
        title="Restore Database"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setModal(null)}
              className="w-full sm:w-auto"
            >
              Batal
            </Button>
            <Button
              loading={actionLoading}
              onClick={handleRestore}
              className="w-full sm:w-auto"
            >
              Restore Sekarang
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-300">
            Database saat ini akan diganti. Database lama akan di-backup
            otomatis sebelum restore.
          </div>
          {selected && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-sm">
              <p className="font-mono text-slate-700 dark:text-slate-200">
                {selected.nama_file}
              </p>
              <p className="text-slate-400 text-xs mt-1">
                {fmtDate(selected.tgl_backup)} · {fmt(selected.ukuran)}
              </p>
            </div>
          )}
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Aplikasi akan restart otomatis setelah restore.
          </p>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        open={modal === "delete"}
        onClose={() => setModal(null)}
        title="Hapus Backup"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setModal(null)}
              className="w-full sm:w-auto"
            >
              Batal
            </Button>
            <Button
              variant="danger"
              loading={actionLoading}
              onClick={handleDelete}
              className="w-full sm:w-auto"
            >
              Hapus
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
          Yakin ingin menghapus backup ini?
        </p>
        {selected && (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-sm font-mono">
            {selected.nama_file}
          </div>
        )}
      </Modal>

      {/* Import Modal */}
      <Modal
        open={modal === "import"}
        onClose={() => {
          setModal(null);
          setImportFile(null);
        }}
        title="Import Database"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setModal(null);
                setImportFile(null);
              }}
              className="w-full sm:w-auto"
            >
              Batal
            </Button>
            <Button
              loading={actionLoading}
              onClick={handleImport}
              disabled={!importFile}
              className="w-full sm:w-auto"
            >
              Import Sekarang
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-300">
            Database saat ini akan diganti. Database lama akan di-backup
            otomatis sebelum import.
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
              Pilih File Backup (.db)
            </label>
            <input
              type="file"
              accept=".db,.sqlite,.sqlite3"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 dark:file:bg-primary-900/30 dark:file:text-primary-400"
            />
          </div>

          {importFile && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-sm">
              <p className="font-medium text-slate-700 dark:text-slate-200">
                {importFile.name}
              </p>
              <p className="text-slate-400 text-xs mt-1">
                {fmt(importFile.size)}
              </p>
            </div>
          )}

          <p className="text-sm text-slate-500 dark:text-slate-400">
            Aplikasi akan restart otomatis setelah import.
          </p>
        </div>
      </Modal>
    </div>
  );
}
