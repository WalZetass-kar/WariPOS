import { sqlite } from '../../database/connection.js'
import { LoyaltyService } from '../services/loyaltyService.js'

function initTables() {
  try {
    sqlite.prepare(`
      CREATE TABLE IF NOT EXISTS mediasoft_loyalty_tiers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        min_points INTEGER NOT NULL,
        discount_percent INTEGER DEFAULT 0,
        benefits TEXT,
        color TEXT DEFAULT '#FFD700',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run()
  } catch (e) {
    console.error('Failed to init loyalty tables:', e)
  }
}
initTables()

export class LoyaltyController {
  static getTiers() {
    return { success: true, data: LoyaltyService.getTiers() }
  }

  static getCustomerTier(customerId: string) {
    return LoyaltyService.getCustomerTierInfo(customerId)
  }

  static calculatePoints(amount: number, tierId: number = 1) {
    const points = LoyaltyService.calculatePoints(amount, tierId)
    return { success: true, data: { points } }
  }

  static redeemPoints(customerId: string, points: number) {
    const result = LoyaltyService.redeemPoints(customerId, points)
    return result
  }

  static createTier(data: any) {
    try {
      const result = sqlite.prepare(`
        INSERT INTO mediasoft_loyalty_tiers (name, min_points, discount_percent, benefits, color, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).run(data.name, data.min_points, data.discount_percent || 0, data.benefits || '', data.color || '#FFD700')
      return { success: true, data: { id: result.lastInsertRowid } }
    } catch (error) {
      return { success: false, message: String(error) }
    }
  }

  static updateTier(id: number, data: any) {
    try {
      sqlite.prepare(`
        UPDATE mediasoft_loyalty_tiers SET name = ?, min_points = ?, discount_percent = ?, benefits = ?, color = ?
        WHERE id = ?
      `).run(data.name, data.min_points, data.discount_percent, data.benefits, data.color, id)
      return { success: true }
    } catch (error) {
      return { success: false, message: String(error) }
    }
  }

  static deleteTier(id: number) {
    try {
      // Check if tier is in use
      const customers = sqlite.prepare('SELECT COUNT(*) as count FROM mediasoft_customer WHERE tier_id = ?').get(id) as any
      if (customers?.count > 0) {
        return { success: false, message: 'Tidak dapat menghapus tier yang sedang digunakan' }
      }
      sqlite.prepare('DELETE FROM mediasoft_loyalty_tiers WHERE id = ?').run(id)
      return { success: true }
    } catch (error) {
      return { success: false, message: String(error) }
    }
  }
}