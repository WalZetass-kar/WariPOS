import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const pathname = url.pathname;
    
    // 1. Health check & Ping
    if (pathname.endsWith("/health") || pathname.endsWith("/ping") || pathname.endsWith("/mediasoft-license") || pathname.endsWith("/mediasoft-license/")) {
      if (req.method === "GET" || req.method === "POST") {
        return new Response(JSON.stringify({ 
          success: true, 
          message: "Mediasoft License Edge Function is healthy",
          time: new Date().toISOString(),
          status: "online"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json().catch(() => ({}));

    // 2. Auth Login (for License Client & Admin)
    if (pathname.endsWith("/auth/login") && req.method === "POST") {
      const { email, password } = body;
      if (!email || !password) {
        return new Response(JSON.stringify({ success: false, message: "Email dan password wajib diisi" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData?.session) {
        return new Response(JSON.stringify({ 
          success: false, 
          message: authError?.message || "Email atau password salah" 
        }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          user: {
            id: authData.user.id,
            email: authData.user.email,
            name: authData.user.user_metadata?.name || "Admin",
            role: "admin",
          },
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2.0 Auth Refresh — renew an expired access token (admin/developer session).
    if (pathname.endsWith("/auth/refresh") && req.method === "POST") {
      const refreshToken = body.refresh_token || body.refreshToken;
      if (!refreshToken) {
        return new Response(JSON.stringify({ success: false, message: "refresh_token wajib diisi", error_code: "NO_REFRESH_TOKEN" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

      if (refreshError || !refreshed?.session) {
        return new Response(JSON.stringify({
          success: false,
          message: refreshError?.message || "Sesi tidak dapat diperbarui. Login ulang.",
          error_code: "SESSION_EXPIRED",
        }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          access_token: refreshed.session.access_token,
          refresh_token: refreshed.session.refresh_token,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2.0b Device heartbeat — keep customer_devices.last_seen_at fresh so the
    // Developer Panel shows an accurate online/offline badge.
    if (pathname.endsWith("/heartbeat") && req.method === "POST") {
      const hbEmail = (body.email || body.username || "").toLowerCase().trim();
      const hbDeviceId = body.deviceId || body.device?.deviceId;
      if (hbDeviceId) {
        const patch: Record<string, unknown> = { last_seen_at: new Date().toISOString() };
        if (body.device?.osName || body.osName) patch.os_name = body.device?.osName || body.osName;
        if (body.device?.appVersion || body.appVersion) patch.app_version = body.device?.appVersion || body.appVersion;

        let query = supabase.from("customer_devices").update(patch).eq("device_id", hbDeviceId);
        if (hbEmail) {
          const { data: hbCustomer } = await supabase
            .from("license_customers")
            .select("id")
            .eq("email", hbEmail)
            .single();
          if (hbCustomer) query = query.eq("customer_id", hbCustomer.id);
        }
        await query;
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2.1 Register Trial / New Buyer Account from Mobile / Web
    if ((pathname.endsWith("/register-trial") || pathname.endsWith("/customer/register") || pathname.endsWith("/auth/register-demo")) && req.method === "POST") {
      const { email, password, name, phone, device } = body;

      if (!email) throw new Error("Email wajib diisi");

      // 1. Check if customer already exists
      const { data: existingCustomers } = await supabase
        .from('license_customers')
        .select('id, email')
        .eq('email', email.toLowerCase().trim());

      if (existingCustomers && existingCustomers.length > 0) {
        return new Response(JSON.stringify({
          success: false,
          message: "Email sudah terdaftar. Silakan login atau gunakan email lain.",
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 2. Create customer in license_customers
      const customerName = name || email.split('@')[0] || 'Pembeli';
      const { data: newCustomer, error: createCustErr } = await supabase
        .from('license_customers')
        .insert({
          email: email.toLowerCase().trim(),
          name: customerName,
          phone: phone || null,
          status: 'active',
          metadata: {
            registered_from: 'mobile_app',
            phone: phone || null,
          }
        })
        .select()
        .single();

      if (createCustErr) throw createCustErr;

      // 3. Find TRIAL_3_DAYS plan or STANDARD plan
      const { data: trialPlans } = await supabase
        .from('subscription_plans')
        .select('id, code, name, duration_days, price')
        .or('code.eq.TRIAL_3_DAYS,name.ilike.%Trial%')
        .limit(1);

      let trialPlan = trialPlans && trialPlans[0];
      if (!trialPlan) {
        const { data: stdPlans } = await supabase
          .from('subscription_plans')
          .select('id, code, name, duration_days, price')
          .limit(1);
        trialPlan = stdPlans && stdPlans[0];
      }

      // 4. Create customer_subscription (3 days trial)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (trialPlan?.duration_days || 3));

      let subscriptionRecord = null;
      if (trialPlan && newCustomer) {
        const { data: newSub } = await supabase
          .from('customer_subscriptions')
          .insert({
            customer_id: newCustomer.id,
            plan_id: trialPlan.id,
            status: 'active',
            started_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
          })
          .select()
          .single();
        subscriptionRecord = newSub;
      }

      // 5. Register device in customer_devices if device info provided
      const deviceId = device?.deviceId || `mobile-${Date.now()}`;
      const deviceName = device?.deviceName || device?.osName || 'Android Device';
      const osName = device?.osName || 'Android';
      const appVersion = device?.appVersion || '2.1.0';

      if (newCustomer) {
        await supabase
          .from('customer_devices')
          .insert({
            customer_id: newCustomer.id,
            device_id: deviceId,
            device_name: deviceName,
            os_name: osName,
            app_version: appVersion,
            status: 'active',
            first_seen_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
          });
      }

      return new Response(JSON.stringify({
        success: true,
        message: "Pendaftaran berhasil! Akun trial 3 hari aktif.",
        data: {
          customer: newCustomer,
          subscription: subscriptionRecord,
          plan: trialPlan,
          device_id: deviceId,
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2.2 Customer Login (from Mobile App)
    if (pathname.endsWith("/customer/login") && req.method === "POST") {
      const { email, password, device } = body;
      if (!email) throw new Error("Email wajib diisi");

      const { data: customer } = await supabase
        .from('license_customers')
        .select(`
          id, name, email, phone, status,
          customer_subscriptions (
            id, status, expires_at, started_at,
            subscription_plans ( id, code, name, duration_days, price )
          ),
          customer_devices (
            id, device_id, device_name, status, last_seen_at
          )
        `)
        .eq('email', email.toLowerCase().trim())
        .single();

      if (!customer) {
        return new Response(JSON.stringify({
          success: false,
          message: "Akun pembeli belum terdaftar. Silakan daftar akun baru terlebih dahulu.",
        }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update or insert device
      if (device?.deviceId) {
        const deviceId = device.deviceId;
        const deviceName = device.deviceName || 'Android Device';
        const osName = device.osName || 'Android';
        const appVersion = device.appVersion || '2.1.0';

        const { data: existDev } = await supabase
          .from('customer_devices')
          .select('id')
          .eq('customer_id', customer.id)
          .eq('device_id', deviceId)
          .single();

        if (existDev) {
          await supabase.from('customer_devices').update({
            last_seen_at: new Date().toISOString(),
            device_name: deviceName,
            app_version: appVersion,
          }).eq('id', existDev.id);
        } else {
          await supabase.from('customer_devices').insert({
            customer_id: customer.id,
            device_id: deviceId,
            device_name: deviceName,
            os_name: osName,
            app_version: appVersion,
            status: 'active',
            first_seen_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
          });
        }
      }

      const sub = (customer.customer_subscriptions || [])[0];
      const plan = sub?.subscription_plans;

      return new Response(JSON.stringify({
        success: true,
        data: {
          user: {
            id: customer.id,
            email: customer.email,
            name: customer.name,
            phone: customer.phone,
            status: customer.status,
          },
          subscription: sub ? {
            id: sub.id,
            status: sub.status,
            expires_at: sub.expires_at,
            plan: plan || null,
          } : null,
          plan: plan || null,
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2.3 Check License / Sync
    if ((pathname.endsWith("/check-license") || pathname.endsWith("/license/check")) && req.method === "POST") {
      const { email, username } = body;
      // Client sends the device either flat (deviceId) or nested (device.deviceId).
      const device = body.device || {};
      const deviceId = body.deviceId || device.deviceId || null;
      const searchEmail = (email || username || '').toLowerCase().trim();

      if (searchEmail) {
        const { data: customer } = await supabase
          .from('license_customers')
          .select(`
            id, name, email, status, force_popup_code, force_popup_until,
            customer_subscriptions (
              id, status, expires_at, started_at,
              subscription_plans ( id, code, name, duration_days, price )
            )
          `)
          .eq('email', searchEmail)
          .single();

        if (customer) {
          let deviceStatus: string | null = null;

          if (deviceId) {
            const { data: existDev } = await supabase
              .from('customer_devices')
              .select('id, status')
              .eq('customer_id', customer.id)
              .eq('device_id', deviceId)
              .maybeSingle();

            if (existDev) {
              deviceStatus = existDev.status;
              await supabase.from('customer_devices').update({
                last_seen_at: new Date().toISOString(),
                ...(device.deviceName ? { device_name: device.deviceName } : {}),
                ...(device.osName ? { os_name: device.osName } : {}),
                ...(device.appVersion ? { app_version: device.appVersion } : {}),
              }).eq('id', existDev.id);
            } else {
              // Re-register a device that was never persisted (e.g. only ever
              // seen a periodic check, never a login) so it shows up for the developer.
              deviceStatus = 'active';
              await supabase.from('customer_devices').insert({
                customer_id: customer.id,
                device_id: deviceId,
                device_name: device.deviceName || device.osName || 'Device',
                os_name: device.osName || null,
                app_version: device.appVersion || null,
                status: 'active',
                first_seen_at: new Date().toISOString(),
                last_seen_at: new Date().toISOString(),
              });
            }
          }

          const sub = (customer.customer_subscriptions || [])[0];
          const plan = sub?.subscription_plans;
          const expired = !!sub?.expires_at && new Date(sub.expires_at).getTime() < Date.now();

          // Developer blocked this specific device → hard stop on the client.
          if (deviceStatus === 'blocked') {
            return new Response(JSON.stringify({
              success: false,
              message: "Perangkat ini diblokir oleh developer. Hubungi admin.",
              data: {
                error_code: "DEVICE_BLOCKED",
                status: "blocked",
                subscription: sub ? { id: sub.id, status: sub.status, expires_at: sub.expires_at, plan: plan || null } : null,
              },
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          return new Response(JSON.stringify({
            success: true,
            data: {
              subscription: sub ? {
                id: sub.id,
                status: sub.status,
                expires_at: sub.expires_at,
                plan: plan || null,
              } : null,
              force_popup_code: customer.force_popup_code,
              force_popup_until: customer.force_popup_until,
              status: customer.status,
              ...(expired ? { error_code: "EXPIRED", expired: true } : {}),
            }
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          subscription: {
            status: 'ACTIVE',
            plan: { code: 'STANDARD', name: 'Standard' },
          }
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Plans list
    if ((pathname.endsWith("/plans") || pathname.endsWith("/admin/plans")) && req.method === "GET") {
      const { data: plans, error: planErr } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('sort_order', { ascending: true });

      if (planErr) throw planErr;
      return new Response(JSON.stringify({ success: true, data: plans || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Admin Users list (Registered buyer accounts)
    if (pathname.endsWith("/admin/users") && req.method === "GET") {
      const search = url.searchParams.get("search") || "";
      const status = url.searchParams.get("status") || "";

      let query = supabase
        .from('license_customers')
        .select(`
          id, name, email, phone, status, created_at, metadata,
          customer_subscriptions (
            id, status, expires_at, started_at,
            subscription_plans ( id, code, name, duration_days, price )
          ),
          customer_devices (
            id, device_id, device_name, status, last_seen_at
          )
        `)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
      }
      if (status) {
        query = query.ilike('status', `%${status}%`);
      }

      const { data: customers, error: custError } = await query;
      if (custError) throw custError;

      const formatted = (customers || []).map((c: any) => {
        const sub = (c.customer_subscriptions || [])[0];
        const plan = sub?.subscription_plans;
        const meta = c.metadata || {};
        const activeDevices = (c.customer_devices || []).filter((d: any) => d.status === 'active').length;

        return {
          id: String(c.id),
          name: c.name || meta.company_name || 'Pembeli',
          email: c.email,
          phone: c.phone || meta.phone || null,
          status: (c.status || 'active').toLowerCase(),
          plan_code: plan?.code || 'STANDARD',
          plan_name: plan?.name || 'Standard',
          sub_status: (sub?.status || 'active').toLowerCase(),
          expired_at: sub?.expires_at || null,
          active_devices: activeDevices || 1,
          created_at: c.created_at,
          force_popup_code: c.force_popup_code || null,
        };
      });

      return new Response(JSON.stringify({ success: true, data: formatted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4.0 Admin Create User (Developer / Buyer / Admin)
    if (pathname.endsWith("/admin/users") && req.method === "POST") {
      const { name, email, password, phone, role, plan_code, duration_days } = body;
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanName = String(name || cleanEmail);
      const userRole = String(role || 'developer').toLowerCase();

      if (!cleanEmail) {
        return new Response(JSON.stringify({ success: false, message: "Email atau username wajib diisi" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 1. Create or ensure Auth User in Supabase Auth if email format
      let authUserId: string | null = null;
      if (cleanEmail.includes('@')) {
        try {
          const { data: authUser } = await supabase.auth.admin.createUser({
            email: cleanEmail,
            password: password || "12345678",
            email_confirm: true,
            user_metadata: { name: cleanName, role: userRole },
          });
          if (authUser?.user) authUserId = authUser.user.id;
        } catch {
          // Auth user might already exist
        }
      }

      // 2. Insert or update license_customers
      const { data: existingCust } = await supabase
        .from('license_customers')
        .select('id')
        .eq('email', cleanEmail)
        .maybeSingle();

      let customerId = existingCust?.id;
      if (!customerId) {
        const { data: newCust, error: custErr } = await supabase
          .from('license_customers')
          .insert({
            name: cleanName,
            email: cleanEmail,
            phone: phone || null,
            status: 'active',
            metadata: { role: userRole, auth_user_id: authUserId },
          })
          .select('id')
          .single();
        if (custErr) throw custErr;
        customerId = newCust?.id;
      }

      // 3. If plan_code provided, link customer_subscriptions
      if (customerId && plan_code && userRole !== 'developer') {
        const { data: plan } = await supabase
          .from('subscription_plans')
          .select('id, duration_days')
          .eq('code', plan_code)
          .maybeSingle();

        const duration = duration_days !== undefined ? Number(duration_days) : (plan?.duration_days ?? 365);
        const expiresAt = duration === 0 ? null : new Date(Date.now() + duration * 86400000).toISOString();

        await supabase.from('customer_subscriptions').upsert({
          customer_id: customerId,
          plan_id: plan?.id,
          status: 'active',
          started_at: new Date().toISOString(),
          expires_at: expiresAt,
        });
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Akun ${userRole} "${cleanName}" berhasil dibuat`,
        data: { id: customerId, name: cleanName, email: cleanEmail, role: userRole }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4.1 Admin Delete User
    if (pathname.includes("/admin/users/") && req.method === "DELETE") {
      const parts = pathname.split("/");
      const customerId = parts[parts.length - 1];

      // Delete associated devices, subscriptions, payments
      await supabase.from('customer_devices').delete().eq('customer_id', customerId);
      await supabase.from('customer_subscriptions').delete().eq('customer_id', customerId);
      await supabase.from('license_payments').delete().eq('customer_id', customerId);
      const { error: delError } = await supabase.from('license_customers').delete().eq('id', customerId);
      if (delError) throw delError;

      return new Response(JSON.stringify({ success: true, message: "Pengguna berhasil dihapus" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4.2 Admin Reset Password
    if (pathname.includes("/admin/users/") && pathname.endsWith("/reset-password") && req.method === "POST") {
      const parts = pathname.split("/");
      const customerId = parts[parts.length - 2];

      const { data: customer } = await supabase
        .from('license_customers')
        .select('id, email, auth_user_id')
        .eq('id', customerId)
        .single();

      const newPassword = body.new_password || `Pass${Math.random().toString(36).slice(-6)}!`;

      if (customer?.auth_user_id) {
        await supabase.auth.admin.updateUserById(customer.auth_user_id, { password: newPassword });
      }

      return new Response(JSON.stringify({
        success: true,
        message: "Password berhasil di-reset",
        data: { new_password: newPassword, password: newPassword },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4.3 Admin Change Plan
    if (pathname.includes("/admin/users/") && pathname.endsWith("/plan") && (req.method === "PUT" || req.method === "PATCH")) {
      const parts = pathname.split("/");
      const customerId = parts[parts.length - 2];
      const planCode = body.plan_code || body.code;
      const durationDays = body.duration_days !== undefined ? Number(body.duration_days) : null;

      const { data: plans } = await supabase
        .from('subscription_plans')
        .select('id, code, duration_days')
        .eq('code', planCode);

      const plan = (plans || [])[0];
      if (plan) {
        const days = durationDays !== null ? durationDays : plan.duration_days;
        const expiresAt = days === 0 ? null : new Date(Date.now() + days * 86400000).toISOString();

        await supabase
          .from('customer_subscriptions')
          .update({
            plan_id: plan.id,
            status: 'ACTIVE',
            expires_at: expiresAt,
            started_at: new Date().toISOString(),
          })
          .eq('customer_id', customerId);
      }

      return new Response(JSON.stringify({ success: true, message: "Paket berhasil diubah" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4.4 Admin Update User (Status, Popup, Metadata)
    if (pathname.includes("/admin/users/") && req.method === "PATCH") {
      const parts = pathname.split("/");
      const customerId = parts[parts.length - 1];

      const updatePayload: Record<string, any> = {};
      if (body.name) updatePayload.name = body.name;
      if (body.phone !== undefined) updatePayload.phone = body.phone;
      if (body.status) updatePayload.status = String(body.status).toUpperCase();
      if (body.force_popup_code !== undefined) updatePayload.force_popup_code = body.force_popup_code;
      if (body.force_popup_until !== undefined) updatePayload.force_popup_until = body.force_popup_until;

      const { error: updateError } = await supabase
        .from('license_customers')
        .update(updatePayload)
        .eq('id', customerId);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true, message: "Status pengguna berhasil diperbarui" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Stats overview (Comprehensive for LicenseDashboard)
    if (pathname.endsWith("/admin/stats") && req.method === "GET") {
      const { data: customers } = await supabase
        .from('license_customers')
        .select('id, name, email, created_at')
        .order('created_at', { ascending: false });

      const { data: devices } = await supabase
        .from('customer_devices')
        .select('id, device_id, device_name, os_name, app_version, status, last_seen_at, first_seen_at');

      const { data: subscriptions } = await supabase
        .from('customer_subscriptions')
        .select('id, status, started_at, expires_at, plan_id');

      const { data: plans } = await supabase
        .from('subscription_plans')
        .select('id, price, code, name');

      const planMap = new Map((plans || []).map((p: any) => [p.id, Number(p.price || 0)]));

      const totalUsers = (customers || []).length;
      const totalDevices = (devices || []).length;
      const activeDevices = (devices || []).filter((d: any) => d.status === 'active').length;
      const blockedDevices = (devices || []).filter((d: any) => d.status === 'blocked').length;

      // Online devices (last seen in last 24h or active)
      const nowMs = Date.now();
      const onlineDevices = (devices || []).filter((d: any) => {
        if (!d.last_seen_at) return false;
        const diffHours = (nowMs - new Date(d.last_seen_at).getTime()) / (1000 * 60 * 60);
        return diffHours <= 24 && d.status === 'active';
      }).length;

      let activeSubs = 0;
      let expiredSubs = 0;
      let revenueThisMonth = 0;
      let revenueThisYear = 0;
      let totalPaidTransactions = 0;

      // Group actual revenue by month (format: YYYY-MM)
      const monthlyRevenueMap: Record<string, number> = {};

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-11

      // Initialize past 6 months with 0
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const past6MonthsKeys: Array<{ key: string; label: string }> = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - i, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const key = `${y}-${m}`;
        past6MonthsKeys.push({ key, label: months[d.getMonth()] });
        monthlyRevenueMap[key] = 0;
      }

      (subscriptions || []).forEach((s: any) => {
        const isAct = s.status?.toLowerCase() === 'active';
        const price = planMap.get(s.plan_id) || 0;
        const subDate = s.started_at ? new Date(s.started_at) : (s.created_at ? new Date(s.created_at) : null);

        if (isAct) {
          activeSubs++;
        } else {
          expiredSubs++;
        }

        if (price > 0 && subDate && !isNaN(subDate.getTime())) {
          totalPaidTransactions++;
          const y = subDate.getFullYear();
          const m = String(subDate.getMonth() + 1).padStart(2, '0');
          const key = `${y}-${m}`;

          if (monthlyRevenueMap[key] !== undefined) {
            monthlyRevenueMap[key] += price;
          }

          if (y === currentYear) {
            revenueThisYear += price;
            if (subDate.getMonth() === currentMonth) {
              revenueThisMonth += price;
            }
          }
        }
      });

      // Format revenue_by_month for chart (purely real data)
      const revenueByMonth = past6MonthsKeys.map(item => ({
        month: item.label,
        total: monthlyRevenueMap[item.key] || 0,
      }));

      // App versions breakdown
      const activeVersions: Record<string, number> = {};
      (devices || []).forEach((d: any) => {
        const v = d.app_version || '2.1.0';
        activeVersions[v] = (activeVersions[v] || 0) + 1;
      });

      // Recent activity from real customer records
      const recentActivity = (customers || []).slice(0, 5).map((c: any) => ({
        id: String(c.id),
        event_type: 'USER_REGISTER',
        action: `Pendaftaran akun ${c.name || c.email}`,
        created_at: c.created_at || new Date().toISOString(),
      }));

      const payload = {
        users: totalUsers,
        total_users: totalUsers,
        total_devices: totalDevices,
        active_devices: activeDevices,
        blocked_devices: blockedDevices,
        device_online: onlineDevices,
        user_online: Math.max(1, onlineDevices),
        active_subscriptions: activeSubs,
        expired_subscriptions: expiredSubs,
        revenue_month: revenueThisMonth,
        revenue_year: revenueThisYear,
        total_transactions: totalPaidTransactions,
        active_versions: Object.keys(activeVersions).length > 0 ? activeVersions : { '2.1.0': totalDevices || 1 },
        revenue_by_month: revenueByMonth,
        recent_activity: recentActivity,
        recent_errors: [],
        generated_at: new Date().toISOString(),
      };

      return new Response(JSON.stringify({ success: true, data: payload }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Admin Devices list
    if (pathname.endsWith("/admin/devices") && req.method === "GET") {
      const search = url.searchParams.get("search") || "";
      const status = url.searchParams.get("status") || "";

      let query = supabase
        .from('customer_devices')
        .select(`
          id, device_id, device_name, os_name, app_version, status, last_seen_at, first_seen_at,
          license_customers ( id, name, email, phone )
        `)
        .order('last_seen_at', { ascending: false });

      if (search) {
        query = query.or(`device_id.ilike.%${search}%,device_name.ilike.%${search}%`);
      }
      if (status) {
        query = query.eq('status', status.toLowerCase());
      }

      const { data: devices, error: devError } = await query;
      if (devError) throw devError;

      const formatted = (devices || []).map((d: any) => ({
        id: String(d.id),
        device_id: d.device_id,
        device_name: d.device_name || 'Device',
        os_name: d.os_name || 'Android / Desktop',
        app_version: d.app_version || '2.1.0',
        status: d.status || 'active',
        last_seen_at: d.last_seen_at || d.first_seen_at || new Date().toISOString(),
        created_at: d.first_seen_at || d.last_seen_at || new Date().toISOString(),
        user_name: d.license_customers?.name || 'Customer',
        user_email: d.license_customers?.email || '-',
      }));

      return new Response(JSON.stringify({ success: true, data: formatted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 7. Admin Device Block / Unblock
    if (pathname.includes("/admin/devices/") && pathname.endsWith("/block") && req.method === "POST") {
      const parts = pathname.split("/");
      const deviceId = parts[parts.length - 2];
      await supabase.from('customer_devices').update({ status: 'blocked' }).eq('id', deviceId);
      return new Response(JSON.stringify({ success: true, message: "Device berhasil diblokir" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (pathname.includes("/admin/devices/") && pathname.endsWith("/unblock") && req.method === "POST") {
      const parts = pathname.split("/");
      const deviceId = parts[parts.length - 2];
      await supabase.from('customer_devices').update({ status: 'active' }).eq('id', deviceId);
      return new Response(JSON.stringify({ success: true, message: "Device berhasil diaktifkan kembali" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 7.1 Customer Payment Request (from Mobile / Desktop)
    if ((pathname.endsWith("/payments/manual-request") || pathname.endsWith("/payments/create")) && req.method === "POST") {
      const { email, plan_code, plan_id, amount, notes, method, customer_id, name } = body;
      const cleanEmail = (email || '').toLowerCase().trim();

      // 1. Find customer by email or customer_id
      let customer: any = null;
      if (cleanEmail) {
        const { data: custs } = await supabase
          .from('license_customers')
          .select('id, name, email, phone')
          .eq('email', cleanEmail)
          .limit(1);
        customer = custs && custs[0];
      } else if (customer_id) {
        const { data: custs } = await supabase
          .from('license_customers')
          .select('id, name, email, phone')
          .eq('id', customer_id)
          .limit(1);
        customer = custs && custs[0];
      }

      // If customer not in DB yet, create one
      if (!customer && cleanEmail) {
        const { data: newCust } = await supabase
          .from('license_customers')
          .insert({
            email: cleanEmail,
            name: name || cleanEmail.split('@')[0] || 'Pembeli',
            status: 'active',
            metadata: { registered_from: 'payment_request' }
          })
          .select('id, name, email, phone')
          .single();
        customer = newCust;
      }

      // 2. Find plan
      let plan: any = null;
      if (plan_code) {
        const cleanCode = String(plan_code).trim();
        const { data: plans } = await supabase
          .from('subscription_plans')
          .select('id, code, name, price, duration_days')
          .or(`code.ilike.${cleanCode},name.ilike.%${cleanCode}%`)
          .limit(1);
        plan = plans && plans[0];
      }
      if (!plan && plan_id) {
        const { data: plans } = await supabase
          .from('subscription_plans')
          .select('id, code, name, price, duration_days')
          .eq('id', plan_id)
          .limit(1);
        plan = plans && plans[0];
      }
      if (!plan) {
        const { data: plans } = await supabase
          .from('subscription_plans')
          .select('id, code, name, price, duration_days')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .limit(1);
        plan = plans && plans[0];
      }

      const paymentAmount = Number(amount || plan?.price || 0);
      const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;

      // 3. Insert payment record into license_payments table
      let createdPayment: any = null;
      const cleanPaymentRecord = {
        customer_id: customer?.id || null,
        plan_id: plan?.id || null,
        invoice_number: invoiceNumber,
        amount: paymentAmount,
        payment_method: method || 'manual_transfer',
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      try {
        const { data: lpRes, error: lpErr } = await supabase
          .from('license_payments')
          .insert(cleanPaymentRecord)
          .select('id, invoice_number, amount, status')
          .single();
        if (!lpErr && lpRes) createdPayment = lpRes;
        else if (lpErr) console.error("Insert license_payments error:", lpErr);
      } catch (e) {
        console.error("license_payments exception:", e);
      }

      if (!createdPayment) {
        try {
          const { data: pRes } = await supabase
            .from('payments')
            .insert({
              customer_id: customer?.id || null,
              plan_id: plan?.id || null,
              amount: paymentAmount,
              method: method || 'manual_transfer',
              status: 'pending',
              external_ref: invoiceNumber,
              created_at: new Date().toISOString(),
            })
            .select()
            .single();
          if (pRes) createdPayment = pRes;
        } catch {}
      }

      const waNumber = '6281234567890';
      const waMsg = `Halo Admin Zetass POS, saya ingin konfirmasi pembayaran lisensi:\n\n` +
        `Invoice: ${invoiceNumber}\n` +
        `Akun: ${customer?.name || cleanEmail}\n` +
        `Email: ${cleanEmail}\n` +
        `Paket: ${plan?.name || plan_code} (Rp ${paymentAmount.toLocaleString('id-ID')})\n\n` +
        `Mohon persetujuan dan aktivasi lisensi. Terima kasih.`;

      return new Response(JSON.stringify({
        success: true,
        message: "Permintaan lisensi berhasil dibuat dan menunggu persetujuan admin",
        data: {
          id: createdPayment?.id || invoiceNumber,
          invoice_number: invoiceNumber,
          external_ref: invoiceNumber,
          amount: paymentAmount,
          status: 'pending',
          whatsapp_number: waNumber,
          whatsapp_message: waMsg,
          payment_url: `https://wa.me/${waNumber}?text=${encodeURIComponent(waMsg)}`,
          customer: customer || null,
          plan: plan || null,
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 8. Admin Payments list (Persetujuan Lisensi)
    if (pathname.endsWith("/admin/payments") && req.method === "GET") {
      let formatted: any[] = [];

      // 1. Try querying `license_payments`
      try {
        const { data: payments, error: payError } = await supabase
          .from('license_payments')
          .select(`
            id, invoice_number, amount, status, payment_method, proof_url, created_at, updated_at,
            license_customers ( id, name, email ),
            subscription_plans ( id, code, name )
          `)
          .order('created_at', { ascending: false });

        if (!payError && Array.isArray(payments) && payments.length > 0) {
          formatted = payments.map((p: any) => ({
            id: String(p.id),
            invoice_number: p.invoice_number || `INV-${p.id}`,
            amount: Number(p.amount || 0),
            status: (p.status || 'pending').toLowerCase(),
            method: p.payment_method || 'transfer',
            provider: p.payment_method || 'Manual Transfer',
            proof_url: p.proof_url || null,
            created_at: p.created_at,
            user_name: p.license_customers?.name || 'Customer',
            user_email: p.license_customers?.email || '-',
            plan_name: p.subscription_plans?.name || 'Plan',
            plan_code: p.subscription_plans?.code || 'STANDARD',
          }));
        }
      } catch {}

      // 2. If empty, try querying `payments` table
      if (formatted.length === 0) {
        try {
          const { data: payments, error: payError } = await supabase
            .from('payments')
            .select(`
              id, external_ref, amount, status, method, proof_url, created_at, notes, customer_id, plan_id,
              license_customers ( id, name, email ),
              subscription_plans ( id, code, name )
            `)
            .order('created_at', { ascending: false });

          if (!payError && Array.isArray(payments) && payments.length > 0) {
            formatted = payments.map((p: any) => ({
              id: String(p.id),
              invoice_number: p.external_ref || p.invoice_number || `INV-${p.id}`,
              amount: Number(p.amount || 0),
              status: (p.status || 'pending').toLowerCase(),
              method: p.method || 'transfer',
              provider: p.method || 'Manual Transfer',
              proof_url: p.proof_url || null,
              created_at: p.created_at,
              user_name: p.license_customers?.name || 'Customer',
              user_email: p.license_customers?.email || '-',
              plan_name: p.subscription_plans?.name || 'Plan',
              plan_code: p.subscription_plans?.code || 'STANDARD',
            }));
          }
        } catch {}
      }

      return new Response(JSON.stringify({ success: true, data: formatted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 8.1 Admin Create Manual Payment
    if (pathname.endsWith("/admin/payments") && req.method === "POST") {
      const { user_id, customer_id, plan_code, amount, method, status } = body;
      const custId = customer_id || user_id;

      let planId: any = null;
      if (plan_code) {
        const { data: plans } = await supabase.from('subscription_plans').select('id, duration_days').eq('code', plan_code).limit(1);
        if (plans && plans[0]) planId = plans[0].id;
      }

      const inv = `INV-MANUAL-${Date.now().toString(36).toUpperCase()}`;
      const { data: newP, error: adminPayErr } = await supabase.from('license_payments').insert({
        customer_id: custId,
        plan_id: planId,
        invoice_number: inv,
        amount: Number(amount || 0),
        payment_method: method || 'manual_transfer',
        status: status || 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).select().single();

      if (adminPayErr) {
        console.error('Admin create payment error:', adminPayErr);
      }

      return new Response(JSON.stringify({ success: true, message: "Persetujuan manual dicatat", data: newP }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 8.2 Admin Approve Payment
    if (pathname.includes("/admin/payments/") && pathname.endsWith("/approve") && req.method === "POST") {
      const parts = pathname.split("/");
      const paymentId = parts[parts.length - 2];

      await supabase.from('payments').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', paymentId);
      await supabase.from('license_payments').update({ status: 'paid', updated_at: new Date().toISOString() }).eq('id', paymentId);

      // Fetch payment details to activate subscription
      let custId: string | null = null;
      let planId: string | null = null;

      const { data: p1 } = await supabase.from('payments').select('customer_id, plan_id').eq('id', paymentId).single();
      if (p1) {
        custId = p1.customer_id;
        planId = p1.plan_id;
      } else {
        const { data: p2 } = await supabase.from('license_payments').select('customer_id, plan_id').eq('id', paymentId).single();
        if (p2) {
          custId = p2.customer_id;
          planId = p2.plan_id;
        }
      }

      if (custId && planId) {
        const { data: plan } = await supabase.from('subscription_plans').select('id, code, duration_days').eq('id', planId).single();
        const duration = plan?.duration_days ?? 30;
        const expiresAt = duration === 0 ? null : new Date(Date.now() + duration * 86400000).toISOString();

        // Update active subscription
        const { data: existingSubs } = await supabase
          .from('customer_subscriptions')
          .select('id')
          .eq('customer_id', custId)
          .limit(1);

        if (existingSubs && existingSubs.length > 0) {
          await supabase
            .from('customer_subscriptions')
            .update({
              plan_id: planId,
              status: 'active',
              started_at: new Date().toISOString(),
              expires_at: expiresAt,
            })
            .eq('id', existingSubs[0].id);
        } else {
          await supabase
            .from('customer_subscriptions')
            .insert({
              customer_id: custId,
              plan_id: planId,
              status: 'active',
              started_at: new Date().toISOString(),
              expires_at: expiresAt,
            });
        }
      }

      return new Response(JSON.stringify({ success: true, message: "Pembayaran berhasil disetujui dan lisensi pengguna telah aktif" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 8.3 Admin Delete Payment
    if (pathname.includes("/admin/payments/") && req.method === "DELETE") {
      const parts = pathname.split("/");
      const paymentId = parts[parts.length - 1];

      await supabase.from('payments').delete().eq('id', paymentId);
      await supabase.from('license_payments').delete().eq('id', paymentId);

      return new Response(JSON.stringify({ success: true, message: "Persetujuan lisensi berhasil dihapus" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 9. Admin Popups list
    if (pathname.endsWith("/admin/popups") && req.method === "GET") {
      const { data: popups, error: popError } = await supabase
        .from('popup_rules')
        .select('*')
        .order('id', { ascending: true });

      return new Response(JSON.stringify({ success: true, data: popups || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 10. Admin Revenue overview
    if (pathname.endsWith("/admin/revenue") && req.method === "GET") {
      const { data: plans } = await supabase.from('subscription_plans').select('id, price');
      const { data: subs } = await supabase.from('customer_subscriptions').select('id, plan_id, status, started_at');

      let totalRevenue = 0;
      const planPriceMap = new Map((plans || []).map((p: any) => [p.id, Number(p.price || 0)]));
      (subs || []).forEach((s: any) => {
        if (s.status === 'active' || s.status === 'ACTIVE') {
          totalRevenue += planPriceMap.get(s.plan_id) || 0;
        }
      });

      return new Response(JSON.stringify({
        success: true,
        data: {
          total_revenue: totalRevenue,
          active_subscribers: (subs || []).filter((s: any) => s.status?.toLowerCase() === 'active').length,
          mrr: totalRevenue,
          currency: 'IDR',
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (pathname.endsWith("/generate") && req.method === "POST") {
      const adminSecret = req.headers.get("x-admin-secret");
      if (adminSecret !== Deno.env.get("ADMIN_SECRET")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { 
          status: 401, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      const { customerName, email, plan = "STANDARD", maxDevices = 1, durationDays = 365, companyName = "" } = body;
      
      if (!email || !customerName) {
        throw new Error("Missing required fields: email or customerName");
      }

      const crypto = globalThis.crypto;
      const array = new Uint32Array(3);
      crypto.getRandomValues(array);
      const licenseKey = `ZETASS-${array[0].toString(16).toUpperCase()}-${array[1].toString(16).toUpperCase()}-${array[2].toString(16).toUpperCase()}`;

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + durationDays);

      // 1. Look up subscription_plans by code (array, always 200)
      const { data: planRecords, error: planError } = await supabase
        .from('subscription_plans')
        .select('id, code, name, max_devices, duration_days')
        .eq('code', plan)

      if (planError) throw planError;
      const planRecord = (planRecords || [])[0];
      if (!planRecord) {
        throw new Error(`Plan '${plan}' not found in subscription_plans`);
      }

      // 2. Create customer in license_customers
      const { data: customers, error: customerError } = await supabase
        .from('license_customers')
        .insert([{
          name: customerName,
          email: email,
          metadata: {
            company_name: companyName,
            license_key: licenseKey,
          },
          status: 'ACTIVE',
        }])
        .select()

      if (customerError) throw customerError;
      const customer = (customers || [])[0];
      if (!customer) throw new Error("Failed to create customer");

      // 3. Create subscription in customer_subscriptions
      const { data: subscriptions, error: subError } = await supabase
        .from('customer_subscriptions')
        .insert([{
          customer_id: customer.id,
          plan_id: planRecord.id,
          status: 'ACTIVE',
          expires_at: expiresAt.toISOString(),
          started_at: new Date().toISOString(),
          notes: licenseKey,
          source: 'admin_generated',
        }])
        .select()

      if (subError) throw subError;
      const subscription = (subscriptions || [])[0];
      if (!subscription) throw new Error("Failed to create subscription");

      return new Response(JSON.stringify({ 
        success: true, 
        customer_id: customer.id,
        subscription_id: subscription.id,
        license_key: licenseKey,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (pathname.endsWith("/validate") && req.method === "POST") {
      const { email, licenseKey, deviceId, deviceName, os, appVersion } = body;

      if (!email || !licenseKey || !deviceId) {
        throw new Error("Missing credentials");
      }

      // 1. Look up customer by email (array, always 200)
      const { data: customers, error: customerError } = await supabase
        .from('license_customers')
        .select('id, name, email, status, metadata')
        .eq('email', email)

      if (customerError) throw customerError;
      const customer = (customers || [])[0];
      if (!customer) {
        throw new Error("Customer not found");
      }

      const meta = (customer.metadata || {}) as Record<string, unknown>;
      if (meta.license_key !== licenseKey) {
        throw new Error("Invalid license key or email");
      }

      if (customer.status !== 'ACTIVE') {
        throw new Error(`License is ${customer.status}`);
      }

      // 2. Get active subscription (array, always 200)
      const { data: subscriptions, error: subError } = await supabase
        .from('customer_subscriptions')
        .select('id, status, expires_at, plan_id')
        .eq('customer_id', customer.id)
        .eq('status', 'ACTIVE')

      if (subError) throw subError;
      const subscription = (subscriptions || [])[0];
      if (!subscription) {
        throw new Error("No active subscription found");
      }

      if (subscription.expires_at && new Date(subscription.expires_at) < new Date()) {
        throw new Error("License has expired");
      }

      // 3. Get plan details for max_devices (array, always 200)
      const { data: planRecords, error: planError } = await supabase
        .from('subscription_plans')
        .select('max_devices')
        .eq('id', subscription.plan_id)

      if (planError) throw planError;
      const planRecord = (planRecords || [])[0];

      // 4. Check device registration
      const { data: existingDevices, error: devicesError } = await supabase
        .from('customer_devices')
        .select('*')
        .eq('customer_id', customer.id);

      if (devicesError) throw devicesError;

      const isRegistered = (existingDevices || []).some((d: any) => d.device_id === deviceId);

      if (!isRegistered) {
        if ((existingDevices || []).length >= (planRecord?.max_devices ?? 1)) {
          throw new Error("Device limit reached for this license");
        }
        
        const { error: insertError } = await supabase
          .from('customer_devices')
          .insert([{
            customer_id: customer.id,
            device_id: deviceId,
            device_name: deviceName || null,
            os_name: os || null,
            app_version: appVersion || null,
            last_seen_at: new Date().toISOString(),
            status: 'active',
          }]);
          
        if (insertError) throw insertError;
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: "Device validated",
        customer_id: customer.id,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Route not found" }), { 
      status: 404, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
