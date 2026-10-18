/**
 * Shared module-level SWR cache for the Kasir/Transaksi page.
 * Lives outside React component tree so data survives tab switches
 * without skeleton flash on remount.
 */
import type { Barang, Kategori } from '../../shared/types'

export let cachedKasirProducts: Barang[] | null = null
export let cachedKasirCategories: Kategori[] | null = null

export function setCachedKasirProducts(data: Barang[]) {
  cachedKasirProducts = data
}

export function setCachedKasirCategories(data: Kategori[]) {
  cachedKasirCategories = data
}

export function clearKasirCache() {
  cachedKasirProducts = null
  cachedKasirCategories = null
}
