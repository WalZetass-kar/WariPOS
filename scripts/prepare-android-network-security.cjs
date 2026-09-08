const fs = require('fs')
const path = require('path')

// Certificate pinning for the Supabase domain has been removed: the pinned SPKI
// went stale whenever Supabase/Cloudflare rotated its CA chain, which silently
// broke every HTTPS call from the APK (TLS handshake failure) and made the app
// behave as offline-only. We now rely on standard Android system CA validation.
// HTTPS is still enforced; only plain-HTTP LAN traffic is optionally permitted.
const allowLanHttp = /^(1|true|yes)$/i.test((process.env.ZETASS_POS_ALLOW_LAN_HTTP || '').trim())
const out = path.join(process.cwd(), 'android/app/src/main/res/xml/network_security_config.xml')

const xml = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="${allowLanHttp ? 'true' : 'false'}">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>
`

fs.writeFileSync(out, xml)
console.log(`Generated network_security_config.xml without certificate pinning; LAN HTTP ${allowLanHttp ? 'enabled' : 'disabled'}`)
