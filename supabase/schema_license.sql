-- ====================================================================
-- MEDIASOFT / ZETASS POS — SUPABASE LICENSE & DEVELOPER SCHEMA
-- Jalankan skrip ini di SQL Editor Supabase Anda jika tabel belum ada.
-- ====================================================================

-- 1. TABEL PELANGGAN / USER (license_customers)
CREATE TABLE IF NOT EXISTS public.license_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    status TEXT DEFAULT 'active', -- active, inactive, suspended, blocked
    force_popup_code TEXT,
    force_popup_until TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABEL PAKET LANGGANAN (subscription_plans)
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    price NUMERIC DEFAULT 0 NOT NULL,
    duration_days INTEGER DEFAULT 30 NOT NULL, -- 0 = lifetime
    description TEXT,
    max_devices INTEGER DEFAULT 1,
    max_transactions_per_day INTEGER DEFAULT -1,
    max_products INTEGER DEFAULT -1,
    max_users INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABEL SUBSCRIPTION PELANGGAN (customer_subscriptions)
CREATE TABLE IF NOT EXISTS public.customer_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.license_customers(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'active',
    started_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMPTZ, -- NULL = lifetime/unlimited
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TABEL PERANGKAT TERHUBUNG (customer_devices)
CREATE TABLE IF NOT EXISTS public.customer_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.license_customers(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    device_name TEXT,
    os_name TEXT,
    app_version TEXT,
    status TEXT DEFAULT 'active',
    last_seen_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(customer_id, device_id)
);

-- 5. TABEL PEMBAYARAN LISENSI (license_payments)
CREATE TABLE IF NOT EXISTS public.license_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.license_customers(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
    amount NUMERIC NOT NULL,
    payment_method TEXT DEFAULT 'MANUAL_TRANSFER',
    status TEXT DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
    payment_proof TEXT,
    approved_by TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. TABEL POPUP TEMPLATES (popup_templates)
CREATE TABLE IF NOT EXISTS public.popup_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    action_text TEXT DEFAULT 'Mengerti',
    action_url TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. SEED DATA DEFAULT PAKET
INSERT INTO public.subscription_plans (code, name, price, duration_days, description, max_devices, max_transactions_per_day, max_products, max_users)
VALUES 
    ('WEEKLY', 'Mingguan', 19000, 7, 'Paket 7 hari untuk operasional toko retail', 1, 100, 100, 2),
    ('BASIC_MONTHLY', 'Basic Bulanan', 49000, 30, 'Paket Standar Kasir Toko Retail', 3, -1, 1000, 5),
    ('PRO_MONTHLY', 'Pro Bulanan', 99000, 30, 'Paket Pro Semua Fitur & Laporan Lengkap', 3, -1, -1, 5),
    ('PRO_YEARLY', 'Pro Tahunan', 990000, 365, 'Paket Pro 1 Tahun: max 10 devices & max 15 users', 10, -1, -1, 15),
    ('ENTERPRISE_LIFETIME', 'Enterprise Lifetime', 2500000, 0, 'Akses Seumur Hidup: max 20 devices & max 50 users', 20, -1, -1, 50)
ON CONFLICT (code) DO UPDATE SET
    max_devices = EXCLUDED.max_devices,
    max_users = EXCLUDED.max_users,
    duration_days = EXCLUDED.duration_days;

-- 8. INDEX UNTUK PERFORMA
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.license_customers(email);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON public.customer_subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_devices_customer ON public.customer_devices(customer_id);
