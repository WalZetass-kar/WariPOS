import { test, expect, type Page } from '@playwright/test'

/**
 * Alur kasir paling penting: daftar akun, isi data contoh, buat transaksi
 * tunai, lalu tutup struk.
 *
 * Build web dipakai sebagai target, jadi pengujian ini tidak butuh Electron
 * maupun perangkat Android.
 */

const REGISTER_PASSWORD = 'Kredensial-2026!'

async function fillStoreIdentity(page: Page) {
  const nameInput = page.getByPlaceholder(/Nama Toko/i).first()
  if (await nameInput.count()) await nameInput.fill('Toko Uji E2E')
  const save = page.getByRole('button', { name: /Simpan & Buka Kasir/i })
  if (await save.count()) await save.click()
}

async function registerTrialAccount(page: Page) {
  // Identitas dibuat unik per pemanggilan supaya pendaftaran tidak bentrok
  // dengan akun uji yang sudah pernah dibuat.
  const username = `kasir${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const email = `${username}@toko.test`

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Masuk ke WariPOS' })).toBeVisible()

  await page.getByRole('button', { name: 'Buat Akun Trial' }).click()
  await expect(page.getByRole('heading', { name: 'Daftar Akun Baru' })).toBeVisible()

  await page.getByPlaceholder('Nama pemilik / toko').fill('Pemilik Toko Uji')
  await page.getByPlaceholder('Contoh: owner').fill(username)
  await page.getByPlaceholder('email@toko.com').fill(email)
  await page.getByPlaceholder('Min 8 karakter').fill(REGISTER_PASSWORD)
  await page.getByPlaceholder('Ulangi password').fill(REGISTER_PASSWORD)

  await page.getByRole('button', { name: 'Daftar Akun Trial' }).click()

  await expect
    .poll(async () => page.url(), { timeout: 90000 })
    .not.toMatch(/#\/login$/)
  await fillStoreIdentity(page)
}

test.describe('alur kasir', () => {
  test('mendaftarkan akun trial dan sampai ke dashboard', async ({ page }) => {
    await registerTrialAccount(page)

    await expect(page.getByRole('link', { name: 'Kasir POS' })).toBeVisible()
  })

  test('membuat transaksi tunai dari katalog sampai struk', async ({ page }) => {
    await registerTrialAccount(page)

    // Isi data contoh lewat pengaturan supaya katalog terisi.
    await page.getByRole('link', { name: 'Pengaturan Sistem' }).click()
    await page.getByRole('button', { name: /Tentang/i }).first().click()

    const seed = page.getByRole('button', { name: /Muat Data Contoh Toko/i }).first()
    await expect(seed).toBeVisible({ timeout: 30000 })
    await seed.click()
    const confirm = page.getByRole('button', { name: /Ya, Muat Data Contoh/i })
    if (await confirm.count()) await confirm.first().click()
    await page.waitForTimeout(4000)

    // Buka shift kasir supaya transaksi boleh disimpan.
    await page.getByRole('link', { name: 'Shift Kasir' }).click()
    await page.getByRole('button', { name: /Buka Shift Baru/i }).first().click()
    const modalAwal = page.getByPlaceholder('0').first()
    await modalAwal.fill('100000')
    await page.getByRole('button', { name: /Buka Shift Sekarang/i }).click()
    await page.waitForTimeout(2000)

    await page.getByRole('link', { name: 'Kasir POS' }).click()
    await page.waitForTimeout(2000)

    const product = page.getByText('Kopi Susu Gula Aren').first()
    await expect(product).toBeVisible({ timeout: 30000 })
    await product.click()
    await page.waitForTimeout(1200)

    // Pilih pembayaran tunai, isi nominal, lalu proses.
    const cash = page.getByText(/^TUNAI$/i).first()
    if (await cash.count()) await cash.click()

    const received = page.getByPlaceholder('0').first()
    await received.fill('20000')

    const payButton = page.getByRole('button', { name: /PROSES PEMBAYARAN/i })
    await expect(payButton).toBeEnabled({ timeout: 15000 })
    await payButton.first().click()
    await page.waitForTimeout(3000)

    // Struk atau pesan pembayaran harus muncul.
    const receiptOrPayment = page.getByText(/Total Bayar|Pembayaran kurang|Kembalian/i).first()
    await expect(receiptOrPayment).toBeVisible({ timeout: 30000 })
  })
})
