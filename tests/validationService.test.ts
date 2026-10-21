import { describe, expect, it } from 'vitest'
import {
  BarangSchema,
  CustomerSchema,
  SupplierSchema,
  UserSchema,
  StrongPasswordSchema,
  KasSchema,
  PembelianSchema,
  FileUploadSchema,
  ValidationService,
} from '../src/backend/services/validation'

describe('backend validation schemas', () => {
  it('accepts a complete product', () => {
    const result = BarangSchema.safeParse({
      nama_barang: 'Kopi Susu',
      kd_kategori_barang: 1,
      kd_satuan: 1,
      harga_barang: 18000,
      harga_modal: 12000,
      stok: 10,
      stok_minimum: 2,
    })

    expect(result.success).toBe(true)
  })

  it('rejects a product without a name and with a negative price', () => {
    const result = BarangSchema.safeParse({
      nama_barang: '',
      kd_kategori_barang: 1,
      kd_satuan: 1,
      harga_barang: -1,
      harga_modal: 0,
      stok: 0,
      stok_minimum: 0,
    })

    expect(result.success).toBe(false)
  })

  it('rejects a discount above one hundred percent', () => {
    const result = BarangSchema.safeParse({
      nama_barang: 'Kopi',
      kd_kategori_barang: 1,
      kd_satuan: 1,
      harga_barang: 1000,
      harga_modal: 500,
      stok: 1,
      stok_minimum: 0,
      potongan: 120,
    })

    expect(result.success).toBe(false)
  })

  it('rejects a customer with a broken email', () => {
    const result = CustomerSchema.safeParse({ nama_customer: 'Budi', email: 'budi@' })

    expect(result.success).toBe(false)
  })

  it('rejects a supplier without a name', () => {
    expect(SupplierSchema.safeParse({ nama_suplier: '' }).success).toBe(false)
  })

  it('rejects a user with a short username', () => {
    expect(UserSchema.safeParse({ nama_pengguna: 'ab', kata_sandi: 'password123', nama_lengkap: 'A B' }).success).toBe(false)
  })

  it('demands a strong password', () => {
    expect(StrongPasswordSchema.safeParse({ kata_sandi: 'password' }).success).toBe(false)
    expect(StrongPasswordSchema.safeParse({ kata_sandi: 'Password1!' }).success).toBe(true)
  })

  it('validates a cash drawer', () => {
    expect(KasSchema.safeParse({ modal_awal: 0 }).success).toBe(true)
    expect(KasSchema.safeParse({ modal_awal: -1 }).success).toBe(false)
  })

  it('validates a purchase with at least one item', () => {
    const valid = {
      kd_suplier: 'S-1',
      items: [{ kd_barang: 'B-1', qty: 2, harga_beli: 1000 }],
      yang_dibayar: 2000,
    }
    expect(PembelianSchema.safeParse(valid).success).toBe(true)
    expect(PembelianSchema.safeParse({ ...valid, items: [] }).success).toBe(false)
    expect(PembelianSchema.safeParse({ ...valid, items: [{ kd_barang: 'B-1', qty: 0, harga_beli: 1000 }] }).success).toBe(false)
  })

  it('limits an uploaded file to five megabytes and to image types', () => {
    const small = { filename: 'foto.png', size: 1024, mimetype: 'image/png' }
    expect(FileUploadSchema.safeParse(small).success).toBe(true)
    expect(FileUploadSchema.safeParse({ ...small, size: 6 * 1024 * 1024 }).success).toBe(false)
    expect(FileUploadSchema.safeParse({ ...small, mimetype: 'application/x-msdownload' }).success).toBe(false)
  })
})

describe('ValidationService', () => {
  it('reports the first error message of a product', () => {
    const result = ValidationService.validateBarang({
      nama_barang: '',
      kd_kategori_barang: 1,
      kd_satuan: 1,
      harga_barang: 1000,
      harga_modal: 500,
      stok: 1,
      stok_minimum: 0,
    })

    expect(result.success).toBe(false)
    expect(result.errors?.[0]).toMatch(/Nama barang wajib diisi/)
  })

  it('accepts a valid product', () => {
    const result = ValidationService.validateBarang({
      nama_barang: 'Kopi',
      kd_kategori_barang: 1,
      kd_satuan: 1,
      harga_barang: 1000,
      harga_modal: 500,
      stok: 1,
      stok_minimum: 0,
    })

    expect(result.success).toBe(true)
  })

  it('grades the strength of a password', () => {
    expect(ValidationService.validatePasswordStrength('Password1!').valid).toBe(true)
    expect(ValidationService.validatePasswordStrength('password').valid).toBe(false)
  })

  it('explains why a weak password is refused', () => {
    const weak = ValidationService.validatePasswordStrength('password')

    expect(weak.valid).toBe(false)
    expect(weak.error).toMatch(/huruf besar/)

    const short = ValidationService.validatePasswordStrength('aB1!')
    expect(short.error).toMatch(/minimal 8 karakter/)
  })

  it('validates a strong password through the schema', () => {
    const result = ValidationService.validateStrongPassword('Kredensial-2026!')

    expect(result.success).toBe(true)
  })
})
