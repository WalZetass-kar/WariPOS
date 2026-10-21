/**
 * One-time migration for installs created before the developer role was
 * enforced from the database.
 *
 * Earlier versions granted developer access to any account whose username,
 * display name or email matched a hardcoded list. Those accounts now need an
 * explicit role, so the matching accounts are promoted once and the pattern
 * is never evaluated again.
 */

const LEGACY_DEVELOPER_USERNAMES = [
  'developer',
  'kartikadevi',
  'mihwalmaulana',
  'mihalmaulana',
  'ihwalmaulana',
  'mihwal',
  'mihal',
  'ihwal',
]

const LEGACY_DEVELOPER_NAME_FRAGMENTS = [
  '[developer]',
  'ihwal maulana',
  'mihwal maulana',
  'mihal maulana',
]

const LEGACY_DEVELOPER_EMAIL_PREFIXES = [
  'mihwalmaulana',
  'mihalmaulana',
  'ihwalmaulana',
]

function matchesLegacyDeveloper(
  username: string | null,
  fullName: string | null,
  email: string | null,
): boolean {
  const u = (username || '').toLowerCase().trim()
  const n = (fullName || '').toLowerCase().trim()
  const e = (email || '').toLowerCase().trim()

  if (LEGACY_DEVELOPER_USERNAMES.includes(u)) return true
  if (LEGACY_DEVELOPER_USERNAMES.some(prefix => u.startsWith(prefix))) return true
  if (LEGACY_DEVELOPER_NAME_FRAGMENTS.some(fragment => n.includes(fragment))) return true
  if (LEGACY_DEVELOPER_EMAIL_PREFIXES.some(prefix => e.startsWith(prefix))) return true
  if (e.endsWith('@zetass.dev')) return true

  return false
}

interface LegacyRoleSqlite {
  prepare: (sql: string) => { all: () => unknown[]; run: (params: unknown[]) => unknown }
}

/**
 * Promote the legacy developer accounts to the developer role.
 *
 * The function is idempotent, accounts that already carry a role are left
 * untouched.
 */
export function migrateLegacyDeveloperRoles(sqlite: LegacyRoleSqlite): number {
  let promoted = 0

  try {
    const rows = sqlite
      .prepare(
        `SELECT nama_pengguna, nama_lengkap, email, hak_akses
         FROM mediasoft_pengguna`,
      )
      .all() as Array<{
      nama_pengguna?: string
      nama_lengkap?: string
      email?: string
      hak_akses?: string
    }>

    for (const row of rows) {
      const currentRole = (row.hak_akses || '').toLowerCase().trim()
      if (currentRole === 'developer' || currentRole === 'super_admin') continue
      if (!matchesLegacyDeveloper(row.nama_pengguna ?? null, row.nama_lengkap ?? null, row.email ?? null)) continue

      sqlite
        .prepare(
          `UPDATE mediasoft_pengguna
           SET hak_akses = 'developer'
           WHERE nama_pengguna = ?`,
        )
        .run([row.nama_pengguna])
      promoted += 1
    }
  } catch (err: any) {
    console.warn('[Database] Migrasi peran developer dilewati:', err?.message)
  }

  return promoted
}
