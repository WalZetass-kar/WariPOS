# WariPOS Stores

State management global untuk WariPOS.

## Stores

### `useCartStore`
Mengelola state keranjang belanja secara global.
- `cart` — daftar item di keranjang
- `selectedCustomer` — customer yang dipilih
- `jenisBayar` — metode pembayaran aktif
- `bayar` — nominal yang dibayarkan
- `promoCode / promoDiskon / promoMsg` — state promo

### `useAppStore` (persisted)
Mengelola state global aplikasi yang perlu disimpan.
- `sidebarCollapsed` — status sidebar
- `activeShiftId` — ID shift kasir aktif
- `pajakPersen` — persentase pajak aktif

## Penggunaan

```typescript
import { useCartStore } from '../stores'

function MyComponent() {
  const { cart, addToCart, clearCart } = useCartStore()
}
```
