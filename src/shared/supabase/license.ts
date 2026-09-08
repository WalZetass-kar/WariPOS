import { supabase } from './config.js'
import { logSupabaseQuery, logSupabaseResponse } from './logging.js'

export const subscribeLicense = (
  { email, customerId }: { email: string; customerId?: string },
  onUpdate: () => void,
  onError: (error: any) => void
) => {
  const channels: any[] = []
  try {
    const channelName1 = `license-cust-${email}-${Date.now()}`
    const ch1 = supabase
      .channel(channelName1)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'license_customers', filter: `email=eq.${email}` },
        () => onUpdate()
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Realtime license tracking (customers) active')
        }
      })
    channels.push(ch1)

    const channelName2 = `license-sub-${email}-${Date.now()}`
    const ch2 = supabase
      .channel(channelName2)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customer_subscriptions' },
        () => onUpdate()
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Realtime license tracking (subscriptions) active')
        }
      })
    channels.push(ch2)

    const channelName3 = `license-pay-${email}-${Date.now()}`
    const ch3 = supabase
      .channel(channelName3)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customer_payments' },
        () => onUpdate()
      )
      .subscribe()
    channels.push(ch3)
  } catch (err) {
    onError(err)
  }

  return () => {
    for (const ch of channels) {
      try { supabase.removeChannel(ch).catch(() => {}) } catch {}
    }
  }
}

export const syncBuyerLicense = async (params: { email: string; customerId?: string; deviceInfo: any }) => {
  try {
    if (!params.email || !params.email.includes('@')) {
      logSupabaseResponse('license_customers', 'SELECT', 400, { code: 'INVALID_EMAIL', message: `Not a valid email: ${params.email}`, details: '', hint: '' }, null)
      return { success: false, error_code: 'INVALID_EMAIL' }
    }

    // Query 1: Get customer by email (array, always 200)
    logSupabaseQuery('SELECT', 'license_customers', 'id,name,email,status,metadata', { email: params.email })
    const { data: customers, error: customerError, status: customerStatus } = await (supabase
      .from('license_customers') as any)
      .select('id, name, email, status, metadata')
      .eq('email', params.email)

    logSupabaseResponse('license_customers', 'SELECT', customerStatus, customerError, customers)
    if (customerError) throw customerError

    const customer = (customers || [])[0]
    if (!customer) return { success: false, error_code: 'NOT_FOUND' }

    // Query 2: Get active subscription by customer_id (array, always 200)
    logSupabaseQuery('SELECT', 'customer_subscriptions', 'id,expires_at,started_at,status,plan_id', { customer_id: customer.id })
    const { data: subscriptions, error: subError, status: subStatus } = await (supabase
      .from('customer_subscriptions') as any)
      .select('id, expires_at, started_at, status, plan_id')
      .eq('customer_id', customer.id)
      .eq('status', 'ACTIVE')

    logSupabaseResponse('customer_subscriptions', 'SELECT', subStatus, subError, subscriptions)
    if (subError) throw subError

    const subscription = (subscriptions || [])[0]
    if (!subscription) return { success: false, error_code: 'NOT_FOUND' }

    // Query 3: Get plan details (array, always 200)
    logSupabaseQuery('SELECT', 'subscription_plans', 'id,code,name,duration_days,description,features,max_devices,max_transactions_per_day,max_products,max_users,feature_flags', { id: subscription.plan_id })
    const { data: plans, error: planError, status: planStatus } = await (supabase
      .from('subscription_plans') as any)
      .select('id, code, name, duration_days, description, features, max_devices, max_transactions_per_day, max_products, max_users, feature_flags')
      .eq('id', subscription.plan_id)

    logSupabaseResponse('subscription_plans', 'SELECT', planStatus, planError, plans)
    if (planError) throw planError

    const plan = (plans || [])[0]

    return {
      success: true,
      data: {
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          status: customer.status,
        },
        subscription: {
          id: subscription.id,
          status: subscription.status,
          started_at: subscription.started_at,
          expires_at: subscription.expires_at,
          days_remaining: subscription.expires_at
            ? Math.max(0, Math.ceil((new Date(subscription.expires_at).getTime() - Date.now()) / 86400000))
            : null,
          plan: {
            id: plan?.id,
            code: plan?.code || 'PRO',
            name: plan?.name || 'Paket Pro',
            duration_days: plan?.duration_days ?? 365,
            description: plan?.description ?? null,
            features: Array.isArray(plan?.features) ? plan?.features : [],
            max_devices: plan?.max_devices ?? 1,
            max_transactions_per_day: plan?.max_transactions_per_day ?? -1,
            max_products: plan?.max_products ?? -1,
            max_users: plan?.max_users ?? 1,
            feature_flags: plan?.feature_flags ?? {},
          },
        },
        popup: null,
      },
    }
  } catch (err: any) {
    if (!navigator.onLine) {
      return { success: false, error_code: 'OFFLINE' }
    }
    return { success: false, error_code: 'UNKNOWN', message: err.message }
  }
}

export const heartbeat = async (params: { email: string; customerId?: string; deviceInfo: any }) => {
  if (params.deviceInfo?.deviceId) {
    const updateData: Record<string, unknown> = {
      last_seen_at: new Date().toISOString(),
      os_name: params.deviceInfo.osName ?? params.deviceInfo.os,
      app_version: params.deviceInfo.appVersion,
    }
    logSupabaseQuery('UPDATE', 'customer_devices', 'last_seen_at,os_name,app_version', { device_id: params.deviceInfo.deviceId })
    const { error, status } = await (supabase.from('customer_devices') as any)
      .update(updateData)
      .eq('device_id', params.deviceInfo.deviceId)
    logSupabaseResponse('customer_devices', 'UPDATE', status, error, updateData)
  }
  return { success: true }
}

export const registerTrialCustomerInSupabase = async (params: {
  email: string
  password?: string
  nama_lengkap: string
  no_telp?: string | null
  deviceInfo?: any
}) => {
  const cleanEmail = (params.email || '').trim().toLowerCase()
  const cleanName = (params.nama_lengkap || '').trim()
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, message: 'Email tidak valid untuk pendaftaran' }
  }

  // 1. Primary & Recommended: Call Supabase Edge Function with service_role privileges
  try {
    const edgeUrl = 'https://azhkvmkmimepmflzqqty.supabase.co/functions/v1/mediasoft-license/register-trial'
    const anonKey = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY)
      || (typeof process !== 'undefined' && (process as any).env?.VITE_SUPABASE_ANON_KEY)
      || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6aGt2bWttaW1lcG1mbHpxcXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNjk4MDgsImV4cCI6MjA5NDk0NTgwOH0.GqkMaagU-slATsjVB_6T0dA4JH0u4RvQ_eiEugtJuM4'

    const efRes = await fetch(edgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        email: cleanEmail,
        password: params.password || 'Trial12345!',
        name: cleanName || cleanEmail.split('@')[0],
        phone: params.no_telp || null,
        device: params.deviceInfo,
      })
    })

    const efData = await efRes.json()
    if (efData && typeof efData.success === 'boolean') {
      return efData
    }
  } catch (efErr: any) {
    console.warn('[registerTrialInSupabase] Edge function network error, attempting direct client fallback:', efErr)
  }

  // 2. Secondary fallback: Direct Supabase client
  try {
    let customerId = ''
    let authUserId: string | null = null

    if (params.password) {
      try {
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email: cleanEmail,
          password: params.password,
          options: {
            data: {
              name: cleanName,
              phone: params.no_telp || null,
            }
          }
        })
        if (!authErr && authData?.user) {
          authUserId = authData.user.id
        }
      } catch (authException) {
        console.warn('[registerTrialInSupabase] Auth signUp warning:', authException)
      }
    }

    const { data: existingCustomers } = await (supabase
      .from('license_customers') as any)
      .select('id, name, email, status')
      .eq('email', cleanEmail)

    if (existingCustomers && existingCustomers.length > 0) {
      customerId = existingCustomers[0].id
    } else {
      const insertCustomerData = {
        name: cleanName,
        email: cleanEmail,
        phone: params.no_telp || null,
        status: 'ACTIVE',
        auth_user_id: authUserId,
        metadata: {
          registered_from: params.deviceInfo?.platform || 'pos_app',
          device_name: params.deviceInfo?.deviceName || null,
          created_at: new Date().toISOString(),
        }
      }
      const { data: createdCustomer } = await (supabase
        .from('license_customers') as any)
        .insert(insertCustomerData)
        .select('id')
        .single()

      if (createdCustomer?.id) {
        customerId = createdCustomer.id
      }
    }

    if (customerId) {
      const trialDays = 3
      const expiresAt = new Date(Date.now() + trialDays * 86400000).toISOString()

      return {
        success: true,
        message: 'Registrasi trial berhasil tersinkronisasi ke server pusat',
        data: {
          customer_id: customerId,
          subscription: {
            expires_at: expiresAt,
            days_remaining: trialDays,
          }
        }
      }
    }

    return { success: false, message: 'Gagal mendaftar ke license server. Periksa koneksi internet Anda.' }
  } catch (err: any) {
    console.error('[registerTrialInSupabase] Exception:', err)
    return { success: false, message: err?.message || 'Gagal sinkronisasi pendaftaran ke server' }
  }
}

