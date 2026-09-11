import { sqlite } from '../../database/connection.js'

export class DebtController {
  static create(data: any) {
    const debtNumber = `${data.type}${Date.now()}`
    const result = sqlite.prepare('INSERT INTO mediasoft_debts (debt_number, type, customer_id, supplier_id, penjualan_id, pembelian_id, total_amount, remaining_amount, due_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(debtNumber, data.type, data.customer_id, data.supplier_id, data.penjualan_id, data.pembelian_id, data.total_amount, data.total_amount, data.due_date, data.notes)
    return { success: true, data: { id: result.lastInsertRowid, debt_number: debtNumber } }
  }

  static addPayment(debtId: number, data: any) {
    const result = sqlite.prepare('INSERT INTO mediasoft_debt_payments (debt_id, amount, payment_method, reference_number, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)').run(debtId, data.amount, data.payment_method, data.reference_number, data.notes, data.created_by)
    
    sqlite.prepare('UPDATE mediasoft_debts SET paid_amount = paid_amount + ?, remaining_amount = remaining_amount - ? WHERE id = ?').run(data.amount, data.amount, debtId)
    
    const debt = sqlite.prepare('SELECT remaining_amount FROM mediasoft_debts WHERE id = ?').get(debtId) as any
    if (debt.remaining_amount <= 0) {
      sqlite.prepare('UPDATE mediasoft_debts SET status = ? WHERE id = ?').run('PAID', debtId)
    } else {
      sqlite.prepare('UPDATE mediasoft_debts SET status = ? WHERE id = ?').run('PARTIAL', debtId)
    }
    
    return { success: true, data: { id: result.lastInsertRowid } }
  }

  static getAll(type?: string) {
    if (type) {
      const data = sqlite.prepare('SELECT d.*, c.nama_customer as customer_name, s.nama_suplier as supplier_name FROM mediasoft_debts d LEFT JOIN mediasoft_customer c ON d.customer_id = c.kd_customer LEFT JOIN mediasoft_supplier s ON d.supplier_id = s.kd_suplier WHERE d.type = ? ORDER BY d.created_at DESC').all(type)
    return { success: true, data }
    }
    const data = sqlite.prepare('SELECT d.*, c.nama_customer as customer_name, s.nama_suplier as supplier_name FROM mediasoft_debts d LEFT JOIN mediasoft_customer c ON d.customer_id = c.kd_customer LEFT JOIN mediasoft_supplier s ON d.supplier_id = s.kd_suplier ORDER BY d.created_at DESC').all()
    return { success: true, data }
  }

  static getPayments(debtId: number) {
    return sqlite.prepare('SELECT dp.*, u.nama_lengkap FROM mediasoft_debt_payments dp LEFT JOIN mediasoft_pengguna u ON dp.created_by = u.nama_pengguna WHERE dp.debt_id = ? ORDER BY dp.created_at DESC').all(debtId)
  }
  
  static delete(id: number) {
    // Delete payments first
    sqlite.prepare('DELETE FROM mediasoft_debt_payments WHERE debt_id = ?').run(id)
    // Delete debt
    sqlite.prepare('DELETE FROM mediasoft_debts WHERE id = ?').run(id)
    return { success: true }
  }
}
