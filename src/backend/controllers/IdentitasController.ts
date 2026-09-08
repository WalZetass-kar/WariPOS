import { IdentitasModel } from '../models/IdentitasModel.js'
import { TaxController } from './TaxController.js'

export class IdentitasController {
  static get() {
    return { success: true, data: IdentitasModel.get() }
  }

  static save(data: Parameters<typeof IdentitasModel.save>[0]) {
    IdentitasModel.save(data)
    if (data?.pajak_persen !== undefined && data?.pajak_persen !== null) {
      try {
        TaxController.setActiveRate(Number(data.pajak_persen) || 0)
      } catch { /* ignore */ }
    }
    return { success: true, message: 'Identitas toko berhasil disimpan' }
  }
}
