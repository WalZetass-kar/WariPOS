export interface KnownPlanSpec {
  code: string
  name: string
  duration_days: number
  max_devices: number
  max_users: number
  max_transactions_per_day: number
  max_products: number
  feature_flags: Record<string, boolean>
}

export const KNOWN_PLAN_SPECS: Record<string, KnownPlanSpec> = {
  PRO_ANNUAL: {
    code: 'PRO_ANNUAL',
    name: 'Tahunan',
    duration_days: 365,
    max_devices: 10,
    max_users: 15,
    max_transactions_per_day: -1,
    max_products: -1,
    feature_flags: {
      backup: true,
      reports: true,
      restore: true,
      api_access: true,
      export_pdf: true,
      multi_user: true,
      auto_backup: true,
      export_data: true,
      pos_cashier: true,
      export_excel: true,
      multi_branch: true,
      stock_opname: true,
      basic_reports: true,
      return_refund: true,
      debt_management: true,
      advanced_reports: true,
      shift_management: true,
      inventory_management: true,
    },
  },
  LIFETIME: {
    code: 'LIFETIME',
    name: 'Sekali Beli Seumur Hidup',
    duration_days: 0,
    max_devices: 20,
    max_users: 50,
    max_transactions_per_day: -1,
    max_products: -1,
    feature_flags: {
      backup: true,
      reports: true,
      restore: true,
      api_access: true,
      export_pdf: true,
      multi_user: true,
      auto_backup: true,
      export_data: true,
      pos_cashier: true,
      export_excel: true,
      multi_branch: true,
      stock_opname: true,
      basic_reports: true,
      return_refund: true,
      debt_management: true,
      advanced_reports: true,
      shift_management: true,
      inventory_management: true,
    },
  },
  PRO_MONTHLY: {
    code: 'PRO_MONTHLY',
    name: 'Pro Bulanan',
    duration_days: 30,
    max_devices: 3,
    max_users: 5,
    max_transactions_per_day: -1,
    max_products: 1000,
    feature_flags: {
      reports: true,
      export_excel: true,
      export_pdf: true,
      multi_user: true,
      backup: true,
      restore: true,
      stock_opname: true,
      debt_management: true,
      shift_management: true,
      api_access: true,
      return_refund: true,
    },
  },
  BASIC_MONTHLY: {
    code: 'BASIC_MONTHLY',
    name: 'Basic Bulanan',
    duration_days: 30,
    max_devices: 1,
    max_users: 1,
    max_transactions_per_day: 500,
    max_products: 500,
    feature_flags: {
      backup: true,
      reports: true,
      restore: false,
      api_access: false,
      export_pdf: false,
      multi_user: false,
      export_excel: false,
      multi_branch: false,
      stock_opname: false,
      return_refund: true,
      debt_management: false,
      shift_management: false,
    },
  },
  WEEKLY: {
    code: 'WEEKLY',
    name: 'Mingguan',
    duration_days: 7,
    max_devices: 1,
    max_users: 2,
    max_transactions_per_day: 100,
    max_products: 100,
    feature_flags: {
      reports: true,
      export_excel: false,
      export_pdf: true,
      multi_user: true,
      backup: true,
      restore: false,
      stock_opname: false,
      debt_management: false,
      shift_management: true,
      api_access: false,
    },
  },
  TRIAL_3_DAYS: {
    code: 'TRIAL_3_DAYS',
    name: 'Trial 3 Hari',
    duration_days: 3,
    max_devices: 3,
    max_users: 10,
    max_transactions_per_day: -1,
    max_products: -1,
    feature_flags: {
      backup: true,
      reports: true,
      restore: true,
      api_access: true,
      export_pdf: true,
      multi_user: true,
      export_excel: true,
      multi_branch: true,
      stock_opname: true,
      return_refund: true,
      debt_management: true,
      shift_management: true,
    },
  },
}

export function getKnownPlanDefaults(codeOrName?: string | null): Partial<KnownPlanSpec> {
  const raw = String(codeOrName ?? '').trim()
  if (!raw) return {}
  const upper = raw.toUpperCase()
  if (upper.includes('ANNUAL') || upper.includes('TAHUN') || upper.includes('YEAR')) {
    return KNOWN_PLAN_SPECS.PRO_ANNUAL
  }
  if (upper.includes('LIFETIME') || upper.includes('SEUMUR') || upper.includes('PERMANENT')) {
    return KNOWN_PLAN_SPECS.LIFETIME
  }
  if (upper.includes('MONTH') || upper.includes('BULAN')) {
    return upper.includes('BASIC') ? KNOWN_PLAN_SPECS.BASIC_MONTHLY : KNOWN_PLAN_SPECS.PRO_MONTHLY
  }
  if (upper.includes('WEEK') || upper.includes('MINGGU')) {
    return KNOWN_PLAN_SPECS.WEEKLY
  }
  if (upper.includes('TRIAL')) {
    return KNOWN_PLAN_SPECS.TRIAL_3_DAYS
  }
  return {}
}
