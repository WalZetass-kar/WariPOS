import { useState, useRef } from 'react'
import type { Barang, CartItem, Customer, Kategori } from '../../../shared/types'
import type { SalePayload, QrisPayment } from './types'

export function useTransaksiState() {
  const [products, setProducts] = useState<Barang[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [bayar, setBayar] = useState('')
  const [jenisBayar, setJenisBayar] = useState<'TUNAI' | 'TRANSFER' | 'QRIS'>('TUNAI')
  const [loading, setLoading] = useState(false)
  
  const [lastKd, setLastKd] = useState<string | null>(null)
  const [showStruk, setShowStruk] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showHeldCarts, setShowHeldCarts] = useState(false)
  const [showClearCart, setShowClearCart] = useState(false)
  const [mobileCartDrawerOpen, setMobileCartDrawerOpen] = useState(false)
  const [mobileCheckoutTab, setMobileCheckoutTab] = useState<'cart' | 'payment'>('cart')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  
  const [showQris, setShowQris] = useState(false)
  const [qrisPayment, setQrisPayment] = useState<QrisPayment | null>(null)
  const [qrisStatus, setQrisStatus] = useState('Menyiapkan QRIS...')
  const [qrisChecking, setQrisChecking] = useState(false)
  const [qrisCompleting, setQrisCompleting] = useState(false)
  
  const [cameraScannerOpen, setCameraScannerOpen] = useState(false)
  const [cameraScannerError, setCameraScannerError] = useState('')
  const [cameraScannerStatus, setCameraScannerStatus] = useState('Menyiapkan kamera...')

  const [categories, setCategories] = useState<Kategori[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')

  const [tipePesanan, setTipePesanan] = useState<'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'>('DINE_IN')
  const [nomorMeja, setNomorMeja] = useState('')
  const [availableTables, setAvailableTables] = useState<Array<{ id: number; nomor_meja: string; label?: string; status: string }>>([])
  const [manualWaPhone, setManualWaPhone] = useState('')

  const [pajakPersen, setPajakPersen] = useState(0)
  const [activeShiftId, setActiveShiftId] = useState<number | null>(null)

  const [promoCode, setPromoCode] = useState('')
  const [promoDiskon, setPromoDiskon] = useState(0)
  const [promoMsg, setPromoMsg] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)

  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDrop, setShowCustomerDrop] = useState(false)
  
  const [showBtPrinterModal, setShowBtPrinterModal] = useState(false)
  const [btPrinting, setBtPrinting] = useState(false)

  const pendingQrisPayloadRef = useRef<SalePayload | null>(null)
  const qrisCreatingRef = useRef(false)
  const qrisCheckingRef = useRef(false)
  const qrisCompletingRef = useRef(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const bayarInputRef = useRef<HTMLInputElement>(null)
  const strukRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const scanIntervalRef = useRef<number | null>(null)
  const customerRef = useRef<HTMLDivElement>(null)
  const barcodeBuffer = useRef('')
  const barcodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  const handleBayarRef = useRef<() => Promise<void>>(async () => {})
  const addToCartRef = useRef<(p: Barang) => void>(() => {})
  const holdCartRef = useRef<(cart: CartItem[], customer: Customer | null) => boolean>(() => false)
  const selectedCustomerRef = useRef<Customer | null>(null)

  return {
    products, setProducts, productsLoading, setProductsLoading, search, setSearch,
    cart, setCart, bayar, setBayar, jenisBayar, setJenisBayar, loading, setLoading,
    lastKd, setLastKd, showStruk, setShowStruk, showSettings, setShowSettings, showShortcuts, setShowShortcuts, showHeldCarts, setShowHeldCarts, showClearCart, setShowClearCart, mobileCartDrawerOpen, setMobileCartDrawerOpen,
    mobileCheckoutTab, setMobileCheckoutTab, viewMode, setViewMode,
    showQris, setShowQris, qrisPayment, setQrisPayment, qrisStatus, setQrisStatus, qrisChecking, setQrisChecking, qrisCompleting, setQrisCompleting,
    cameraScannerOpen, setCameraScannerOpen, cameraScannerError, setCameraScannerError, cameraScannerStatus, setCameraScannerStatus,
    categories, setCategories, selectedCategory, setSelectedCategory,
    tipePesanan, setTipePesanan, nomorMeja, setNomorMeja, availableTables, setAvailableTables, manualWaPhone, setManualWaPhone,
    pajakPersen, setPajakPersen, activeShiftId, setActiveShiftId,
    promoCode, setPromoCode, promoDiskon, setPromoDiskon, promoMsg, setPromoMsg, promoLoading, setPromoLoading,
    customers, setCustomers, selectedCustomer, setSelectedCustomer, customerSearch, setCustomerSearch, showCustomerDrop, setShowCustomerDrop,
    showBtPrinterModal, setShowBtPrinterModal, btPrinting, setBtPrinting,
    pendingQrisPayloadRef, qrisCreatingRef, qrisCheckingRef, qrisCompletingRef, searchRef, bayarInputRef, strukRef, videoRef, cameraStreamRef, scanIntervalRef, customerRef, barcodeBuffer, barcodeTimeoutRef, handleBayarRef, addToCartRef, holdCartRef, selectedCustomerRef
  }
}
