# IMPI Portal Full Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full production-quality rebuild of the IMPI Safety Induction Portal — zero technical debt, light Notion/Linear/Stripe-quality theme, all existing data preserved.

**Architecture:** Vanilla HTML/CSS/JS frontend in `public/`, Netlify Functions backend in `netlify/functions/`, Supabase for data + storage, Resend for email. All API routes mapped via `/api/*` → `/.netlify/functions/*` redirects. No frameworks, no bundlers.

**Tech Stack:** HTML5, CSS custom properties, vanilla JS (ES2020), Netlify Functions (Node.js 18), @supabase/supabase-js v2, resend, custom multipart parser (no busboy needed — keep existing custom parser).

**CRITICAL RULES:**
- `netlify dev` only — NO deployment until user says "deploy to production"
- NEVER alter or delete Supabase data
- JWT is removed — use custom stateless tokens (base64 payload + hash signature)
- portal_settings supports BOTH key/value rows AND single-row JSONB — detect at runtime
- Uploads go to Supabase storage `event-files` bucket (not base64 data URLs)
- All API functions have 3-attempt retry with exponential backoff (500ms → 1s → 2s)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `package.json` | Modify | Remove jsonwebtoken, keep @supabase/supabase-js + resend |
| `netlify.toml` | Modify | Add /api/* → /.netlify/functions/* redirects |
| `netlify/functions/_shared.js` | Rewrite | db(), verifyToken(), ok(), err(), cors(), retry(), hashPassword(), generateToken() |
| `netlify/functions/auth.js` | Rewrite | Master + team user login, custom token gen |
| `netlify/functions/events.js` | Rewrite | Full CRUD, auto-ID gen, retry logic |
| `netlify/functions/complete.js` | Rewrite | Save completion, group support, non-blocking email |
| `netlify/functions/completions.js` | Rewrite | GET with filter, DELETE |
| `netlify/functions/verify.js` | Rewrite | Case-insensitive cert lookup |
| `netlify/functions/check-duplicate.js` | Rewrite | 3-state response per spec |
| `netlify/functions/upload.js` | Rewrite | Supabase storage (not base64) |
| `netlify/functions/design.js` | Rewrite | Dual-format portal_settings adapter |
| `netlify/functions/settings.js` | Rewrite | Admin user CRUD |
| `netlify/functions/topics.js` | Create | Replaces content.js — per-event topics with global fallback |
| `netlify/functions/content.js` | Keep as-is | Backward compat, do not delete |
| `public/verify.html` | Rewrite | Dark verify page, QR scanner, jsQR CDN fallbacks |
| `public/admin-login.html` | Create | Standalone login page |
| `public/index.html` | Rewrite | Light theme landing page |
| `public/induction.html` | Rewrite | Full induction flow, 8 languages, group support |
| `public/admin.html` | Rewrite | Full admin dashboard, light theme, 6 tabs |

---

## Task 1: Infrastructure — package.json + netlify.toml

**Files:**
- Modify: `package.json`
- Modify: `netlify.toml`

- [ ] **Step 1: Update package.json**

```json
{
  "name": "impi-induction-portal",
  "version": "2.0.0",
  "private": true,
  "dependencies": {
    "@supabase/supabase-js": "^2.49.4",
    "resend": "^4.5.1"
  }
}
```

- [ ] **Step 2: Update netlify.toml with /api/* redirects**

```toml
[build]
  publish = "public"
  functions = "netlify/functions"

[[redirects]]
  from = "/api/:func"
  to = "/.netlify/functions/:func"
  status = 200

[[redirects]]
  from = "/admin"
  to = "/admin.html"
  status = 200

[[redirects]]
  from = "/verify"
  to = "/verify.html"
  status = 200

[[redirects]]
  from = "/induction"
  to = "/induction.html"
  status = 200
```

- [ ] **Step 3: Install dependencies**

```bash
cd /Users/shanesteynfaardt/impi-portal && npm install
```

Expected: no errors, `node_modules/@supabase` and `node_modules/resend` present.

- [ ] **Step 4: Commit**

```bash
git add package.json netlify.toml
git commit -m "chore: update deps and add /api/* redirects"
```

---

## Task 2: Backend — _shared.js

**Files:**
- Rewrite: `netlify/functions/_shared.js`

- [ ] **Step 1: Write _shared.js**

```js
const { createClient } = require('@supabase/supabase-js');

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};

function db() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

// djb2-style hash — matches spec: Math.imul(31,h)+charCode, abs().toString(16)+length.toString(16)
function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i);
  return Math.abs(h).toString(16) + str.length.toString(16);
}

function generateToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = hashStr(data + (process.env.ADMIN_SECRET || 'impi-secret-2026'));
  return `${data}.${sig}`;
}

function verifyToken(event) {
  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token || !token.includes('.')) return null;
  try {
    const [data, sig] = token.split('.');
    const expected = hashStr(data + (process.env.ADMIN_SECRET || 'impi-secret-2026'));
    if (sig !== expected) return null;
    return JSON.parse(Buffer.from(data, 'base64url').toString());
  } catch {
    return null;
  }
}

function ok(body) {
  return { statusCode: 200, headers: HEADERS, body: JSON.stringify(body) };
}

function err(msg, code = 400) {
  return { statusCode: code, headers: HEADERS, body: JSON.stringify({ error: msg }) };
}

function cors() {
  return { statusCode: 200, headers: HEADERS, body: '' };
}

async function retry(fn, attempts = 3, delayMs = 500) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      const result = await fn();
      if (!result?.error) return result;
      last = result;
    } catch (e) {
      last = { error: { message: e.message } };
    }
    if (i < attempts - 1) await new Promise(r => setTimeout(r, delayMs * Math.pow(2, i)));
  }
  return last;
}

// portal_settings dual-format adapter
// Supports key/value rows (key PK, value, updated_at) AND single-row JSONB (settings column)
async function getPortalSettings(supabase) {
  const { data: rows, error } = await supabase.from('portal_settings').select('*').limit(100);
  if (error) { console.error('[settings GET]', error.message); return {}; }
  if (!rows || rows.length === 0) return {};
  if ('key' in rows[0]) {
    // key/value format
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  }
  if ('settings' in rows[0]) {
    // legacy JSONB format
    return rows[0].settings || {};
  }
  return {};
}

async function savePortalSettings(supabase, settings) {
  const { data: rows } = await supabase.from('portal_settings').select('*').limit(1);
  const useKeyValue = !rows || rows.length === 0 || 'key' in (rows[0] || {});

  if (useKeyValue) {
    for (const [key, value] of Object.entries(settings)) {
      const { error } = await supabase.from('portal_settings')
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) return error;
    }
    return null;
  }

  // Legacy JSONB fallback
  const existing = rows?.[0];
  const merged = { ...(existing?.settings || {}), ...settings };
  const pkCol = Object.keys(existing || {}).find(k => k !== 'settings');
  if (!pkCol) {
    const { error } = await supabase.from('portal_settings').insert({ settings: merged });
    return error;
  }
  const { error } = await supabase.from('portal_settings')
    .update({ settings: merged }).eq(pkCol, existing[pkCol]);
  return error;
}

module.exports = { db, hashStr, generateToken, verifyToken, ok, err, cors, retry, getPortalSettings, savePortalSettings, HEADERS };
```

- [ ] **Step 2: Verify syntax**

```bash
node -e "require('./netlify/functions/_shared.js'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add netlify/functions/_shared.js
git commit -m "feat: rewrite _shared.js with custom token, retry, dual-format settings adapter"
```

---

## Task 3: Backend — auth.js

**Files:**
- Rewrite: `netlify/functions/auth.js`

- [ ] **Step 1: Write auth.js**

```js
const { db, hashStr, generateToken, ok, err, cors } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return err('Invalid JSON'); }

  const { password, email } = body;
  if (!password) return ok({ success: false, message: 'Password required' });

  const masterPw = process.env.ADMIN_PASSWORD;

  // Master admin — no email required
  if (!email) {
    if (password !== masterPw) {
      return ok({ success: false, message: 'Incorrect password. Team members: enter your email address too.' });
    }
    const token = generateToken({ role: 'admin', email: 'admin@impi', name: 'Admin' });
    return ok({ success: true, token, role: 'admin', name: 'Admin' });
  }

  // Team user login
  const supabase = db();
  const { data: user, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (error || !user) return ok({ success: false, message: 'No account found for this email.' });

  const inputHash = hashStr(password);
  const match = user.password === password
    || user.password_hash === password
    || user.password === inputHash
    || user.password_hash === inputHash;

  if (!match) return ok({ success: false, message: 'Incorrect password.' });

  const token = generateToken({ role: user.role || 'staff', email: user.email, userId: user.id, name: user.name });
  return ok({ success: true, token, role: user.role || 'staff', name: user.name });
};
```

- [ ] **Step 2: Verify syntax**

```bash
node -e "require('./netlify/functions/auth.js'); console.log('OK')"
```

- [ ] **Step 3: Commit**

```bash
git add netlify/functions/auth.js
git commit -m "feat: rewrite auth.js with custom token, hashStr password verify"
```

---

## Task 4: Backend — events.js

**Files:**
- Rewrite: `netlify/functions/events.js`

- [ ] **Step 1: Write events.js**

```js
const { db, verifyToken, ok, err, cors, retry } = require('./_shared');

function genEventId() {
  return 'EVT' + Date.now().toString(36).toUpperCase();
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();

  const supabase = db();
  const user = verifyToken(event);

  if (event.httpMethod === 'GET') {
    const id = event.queryStringParameters?.id;
    if (id) {
      const result = await retry(() => supabase.from('events').select('*').eq('id', id).single());
      if (result.error || !result.data) return err('Event not found', 404);
      return ok(result.data);
    }
    let query = supabase.from('events').select('*').order('created_at', { ascending: false });
    if (!user) query = query.neq('status', 'archived');
    const result = await retry(() => query);
    if (result.error) return err(result.error.message);
    return ok(result.data || []);
  }

  if (!user) return err('Unauthorized', 401);

  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return err('Invalid JSON'); }
    const { id: _id, ...fields } = body;
    const newId = genEventId();
    const result = await retry(() =>
      supabase.from('events').insert([{ id: newId, ...fields }]).select().single()
    );
    if (result.error) { console.error('[events POST]', result.error); return err(result.error.message); }
    return ok(result.data);
  }

  if (event.httpMethod === 'PUT') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return err('Invalid JSON'); }
    const { id, ...fields } = body;
    if (!id) return err('id required');
    const result = await retry(() =>
      supabase.from('events').update(fields).eq('id', id).select().single()
    );
    if (result.error) { console.error('[events PUT]', result.error); return err(result.error.message); }
    return ok(result.data);
  }

  if (event.httpMethod === 'DELETE') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return err('Invalid JSON'); }
    const { id } = body;
    if (!id) return err('id required');
    const result = await retry(() => supabase.from('events').delete().eq('id', id));
    if (result.error) return err(result.error.message);
    return ok({ success: true });
  }

  return err('Method not allowed', 405);
};
```

- [ ] **Step 2: Verify + commit**

```bash
node -e "require('./netlify/functions/events.js'); console.log('OK')" && \
git add netlify/functions/events.js && \
git commit -m "feat: rewrite events.js with retry, auto-ID generation"
```

---

## Task 5: Backend — complete.js

**Files:**
- Rewrite: `netlify/functions/complete.js`

Certificate code format (8 chars uppercase): first 2 chars of full_name + last 3 digits of id_number + 3-char timestamp base36 + 2 random chars.

- [ ] **Step 1: Write complete.js**

```js
const { db, ok, err, cors, retry } = require('./_shared');
const { Resend } = require('resend');

function makeCertCode(name, idNumber) {
  const p1 = (name || 'XX').replace(/[^A-Z]/gi, '').slice(0, 2).toUpperCase().padEnd(2, 'X');
  const p2 = String(idNumber || '000').replace(/\D/g, '').slice(-3).padStart(3, '0');
  const p3 = Date.now().toString(36).slice(-3).toUpperCase();
  const p4 = Math.random().toString(36).slice(2, 4).toUpperCase();
  return (p1 + p2 + p3 + p4).slice(0, 8).toUpperCase();
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return err('Invalid JSON'); }

  const supabase = db();

  // Resend email for existing cert
  if (body.action === 'resend') {
    const { cert_code } = body;
    if (!cert_code) return err('cert_code required');
    const { data: comp } = await supabase.from('completions').select('*').eq('cert_code', cert_code).single();
    if (!comp) return err('Completion not found', 404);
    sendCertEmail(comp).catch(e => console.error('[resend email]', e.message));
    return ok({ success: true });
  }

  const full_name = body.full_name || body.fullName || '';
  const surname = body.surname || '';
  const id_number = body.id_number || body.idNumber || '';
  const id_type = body.id_type || body.idType || 'SA ID';
  const email = body.email || '';
  const phone = body.phone || '';
  const company = body.company || '';
  const trade = body.trade || '';
  const role = body.role || '';
  const event_id = body.event_id || body.eventId || '';
  let cert_code = body.cert_code || body.certCode || makeCertCode(full_name, id_number);
  const completed_at = body.completed_at || new Date().toISOString();
  const is_group = !!(body.is_group || body.isGroup);
  const group_members = Array.isArray(body.group_members || body.groupMembers) ? (body.group_members || body.groupMembers) : [];

  if (!full_name) return err('full_name required');
  if (!event_id) return err('event_id required');

  // Idempotency: if cert_code already exists, return success
  const { data: existing } = await supabase.from('completions').select('cert_code').eq('cert_code', cert_code).maybeSingle();
  if (existing) return ok({ success: true, cert_code, duplicate: true });

  const record = {
    full_name, surname, id_number, id_type,
    email, phone, company, trade, role,
    event_id, cert_code,
    completed_at,
    email_sent: false
  };

  const saveResult = await retry(() => supabase.from('completions').insert([record]));
  if (saveResult.error) {
    console.error('[complete] save error:', saveResult.error);
    return err('Failed to save completion: ' + saveResult.error.message);
  }

  // Save group members (fire and forget errors — main cert is already saved)
  if (is_group && group_members.length > 0) {
    const memberRecords = group_members.map(m => ({
      full_name: m.full_name || m.fullName,
      surname: m.surname,
      id_number: m.id_number || m.idNumber,
      id_type: m.id_type || m.idType || 'SA ID',
      email: m.email || email,
      phone: m.phone || phone,
      company,
      trade: m.trade || trade,
      role: m.role || role,
      event_id,
      cert_code: m.cert_code || makeCertCode(m.full_name || m.fullName, m.id_number || m.idNumber),
      completed_at,
      email_sent: false
    }));
    for (const mr of memberRecords) {
      const { data: existingMember } = await supabase.from('completions').select('cert_code').eq('cert_code', mr.cert_code).maybeSingle();
      if (!existingMember) {
        retry(() => supabase.from('completions').insert([mr])).catch(e => console.error('[complete group member]', e.message));
      }
    }
  }

  // Email — non-blocking
  let emailSent = false;
  if (email) {
    try {
      await sendCertEmail(record, group_members);
      await supabase.from('completions').update({ email_sent: true }).eq('cert_code', cert_code);
      emailSent = true;
    } catch (e) {
      console.error('[complete email]', e.message);
    }
  }

  return ok({ success: true, cert_code, email_sent: emailSent });
};

async function sendCertEmail(comp, groupMembers = []) {
  if (!process.env.RESEND_API_KEY || !comp.email) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const verifyBase = (process.env.SITE_URL || 'https://impi-inductions.netlify.app');
  const verifyUrl = `${verifyBase}/verify?code=${comp.cert_code}`;
  const from = process.env.RESEND_FROM_EMAIL || 'IMPI Safety Services <noreply@impisafety.co.za>';

  const hasGroup = groupMembers.length > 0;
  const subject = hasGroup
    ? `Your IMPI Safety Induction Certificate (+${groupMembers.length} team certificate${groupMembers.length !== 1 ? 's' : ''})`
    : 'Your IMPI Safety Induction Certificate';

  const groupCodesHtml = hasGroup ? `
    <div style="margin:20px 0;padding:16px;background:#fffbeb;border-left:4px solid #f5c800;border-radius:0 8px 8px 0">
      <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#92400e;margin-bottom:10px">Team Member Certificates</div>
      ${groupMembers.map(m => `
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #fde68a">
          <span style="font-size:13px;color:#1f2937">${m.full_name || m.fullName} ${m.surname}</span>
          <span style="font-family:monospace;font-size:14px;font-weight:800;color:#d42b2b;letter-spacing:2px">${m.cert_code}</span>
        </div>
      `).join('')}
    </div>` : '';

  await resend.emails.send({
    from,
    to: comp.email,
    subject,
    html: `
<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
  <div style="background:#d42b2b;padding:24px 32px">
    <div style="color:rgba(255,255,255,0.7);font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase">IMPI Safety Services International</div>
    <div style="color:#fff;font-size:18px;font-weight:800;margin-top:4px">Safety Induction Certificate</div>
  </div>
  <div style="padding:32px">
    <p style="color:#374151;font-size:15px;margin:0 0 24px">Hi <strong>${comp.full_name} ${comp.surname || ''}</strong>,</p>
    <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 24px">
      Your safety induction has been successfully completed. Save or print this certificate and present it at the venue entrance.
    </p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:0 0 24px">
      <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#9ca3af;margin-bottom:6px">Your Certificate Code</div>
      <div style="font-family:monospace;font-size:28px;font-weight:900;color:#d42b2b;letter-spacing:4px;margin-bottom:16px">${comp.cert_code}</div>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:4px 0;font-size:11px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:1px">Name</td><td style="padding:4px 0;font-size:14px;font-weight:600;color:#111;text-align:right">${comp.full_name} ${comp.surname || ''}</td></tr>
        <tr><td style="padding:4px 0;font-size:11px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:1px">ID Type</td><td style="padding:4px 0;font-size:14px;color:#374151;text-align:right">${comp.id_type || 'SA ID'}</td></tr>
        <tr><td style="padding:4px 0;font-size:11px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:1px">Company</td><td style="padding:4px 0;font-size:14px;color:#374151;text-align:right">${comp.company || '—'}</td></tr>
        <tr><td style="padding:4px 0;font-size:11px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:1px">Completed</td><td style="padding:4px 0;font-size:14px;color:#374151;text-align:right">${new Date(comp.completed_at).toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })}</td></tr>
      </table>
    </div>
    ${groupCodesHtml}
    <a href="${verifyUrl}" style="display:inline-block;background:#d42b2b;color:#fff;font-size:13px;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none;margin:0 0 24px">✓ Verify Certificate</a>
    <p style="color:#9ca3af;font-size:12px;line-height:1.5;margin:0">
      This certificate was issued by IMPI Safety Services International.<br>
      Questions? <a href="mailto:info@impisafety.co.za" style="color:#d42b2b">info@impisafety.co.za</a>
    </p>
  </div>
</div>`
  });
}
```

- [ ] **Step 2: Verify + commit**

```bash
node -e "require('./netlify/functions/complete.js'); console.log('OK')" && \
git add netlify/functions/complete.js && \
git commit -m "feat: rewrite complete.js with group certs, non-blocking email, retry"
```

---

## Task 6: Backend — completions.js + verify.js + check-duplicate.js

**Files:**
- Rewrite: `netlify/functions/completions.js`
- Rewrite: `netlify/functions/verify.js`
- Rewrite: `netlify/functions/check-duplicate.js`

- [ ] **Step 1: Write completions.js**

```js
const { db, verifyToken, ok, err, cors, retry } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();

  const user = verifyToken(event);
  if (!user) return err('Unauthorized', 401);

  const supabase = db();

  if (event.httpMethod === 'GET') {
    const eventId = event.queryStringParameters?.eventId;
    let query = supabase.from('completions').select('*').order('completed_at', { ascending: false });
    if (eventId) query = query.eq('event_id', eventId);
    const result = await retry(() => query);
    if (result.error) { console.error('[completions GET]', result.error); return err(result.error.message); }
    return ok(result.data || []);
  }

  if (event.httpMethod === 'DELETE') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return err('Invalid JSON'); }
    const { cert_code } = body;
    if (!cert_code) return err('cert_code required');
    const result = await retry(() => supabase.from('completions').delete().eq('cert_code', cert_code));
    if (result.error) return err(result.error.message);
    return ok({ success: true });
  }

  return err('Method not allowed', 405);
};
```

- [ ] **Step 2: Write verify.js**

```js
const { db, ok, err, cors, retry } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();
  if (event.httpMethod !== 'GET') return err('Method not allowed', 405);

  const code = (event.queryStringParameters?.code || '').trim().toUpperCase();
  if (!code) return err('Certificate code required');

  const supabase = db();
  const result = await retry(() =>
    supabase.from('completions').select('*').ilike('cert_code', code).maybeSingle()
  );

  if (result.error) { console.error('[verify]', result.error); return err(result.error.message); }
  if (!result.data) return ok({ valid: false, message: 'Certificate not found' });

  return ok({ valid: true, ...result.data });
};
```

- [ ] **Step 3: Write check-duplicate.js**

```js
const { db, ok, err, cors, retry } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return err('Invalid JSON'); }

  const { fullName, surname, eventId, idNumber } = body;
  if (!fullName || !surname || !eventId) return err('fullName, surname, eventId required');

  const supabase = db();
  const result = await retry(() =>
    supabase.from('completions')
      .select('cert_code, id_number')
      .eq('event_id', eventId)
      .ilike('full_name', fullName.trim())
      .ilike('surname', surname.trim())
  );

  if (result.error) { console.error('[check-dup]', result.error); return err(result.error.message); }

  const matches = result.data || [];
  if (matches.length === 0) {
    return ok({ isDuplicate: false, alreadyCompleted: false });
  }

  // Same name AND same ID — person already completed, return their cert
  const sameId = matches.find(r => r.id_number === idNumber);
  if (sameId) {
    return ok({ isDuplicate: false, alreadyCompleted: true, existingCode: sameId.cert_code });
  }

  // Same name BUT different ID — potential fraud/duplicate
  return ok({ isDuplicate: true, message: `${fullName} ${surname} has already completed this induction with a different ID.` });
};
```

- [ ] **Step 4: Verify + commit**

```bash
node -e "require('./netlify/functions/completions.js'); require('./netlify/functions/verify.js'); require('./netlify/functions/check-duplicate.js'); console.log('OK')" && \
git add netlify/functions/completions.js netlify/functions/verify.js netlify/functions/check-duplicate.js && \
git commit -m "feat: rewrite completions, verify, check-duplicate with retry and spec-correct logic"
```

---

## Task 7: Backend — upload.js (Supabase storage)

**Files:**
- Rewrite: `netlify/functions/upload.js`

Key change from current: files go to Supabase `event-files` bucket (real URLs), not base64 data URLs.

- [ ] **Step 1: Write upload.js**

```js
const { createClient } = require('@supabase/supabase-js');
const { verifyToken, ok, err, cors, savePortalSettings } = require('./_shared');

const MAX_IMAGE = 3 * 1024 * 1024;
const MAX_PDF   = 8 * 1024 * 1024;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);

  const user = verifyToken(event);
  if (!user) return err('Unauthorized', 401);

  const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
  if (!contentType.includes('multipart/form-data')) return err('multipart/form-data required');

  const boundary = contentType.split('boundary=')[1];
  if (!boundary) return err('No boundary in Content-Type');

  const bodyBuffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
  const parts = parseMultipart(bodyBuffer, boundary);

  const file      = parts.find(p => p.name === 'file');
  const eventId   = parts.find(p => p.name === 'eventId')?.data?.toString().trim();
  const type      = parts.find(p => p.name === 'type')?.data?.toString().trim();
  const settingKey = parts.find(p => p.name === 'settingKey')?.data?.toString().trim();

  if (!file?.data?.length) return err('No file received');

  const ext = (file.filename || '').split('.').pop().toLowerCase();
  const isPdf   = ext === 'pdf';
  const isImage = ['jpg','jpeg','png','gif','webp','svg'].includes(ext);
  if (!isImage && !isPdf) return err('Allowed types: jpg, png, svg, webp, gif, pdf');

  const maxSize = isPdf ? MAX_PDF : MAX_IMAGE;
  if (file.data.length > maxSize) return err(`File too large — max ${isPdf ? '8' : '3'} MB`);

  const mime = file.mimetype
    || (isPdf ? 'application/pdf' : ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`);

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const ts = Date.now();

  // Design asset → portal_settings
  if (type === 'design_asset' || eventId === 'portal') {
    if (!settingKey) return err('settingKey required for design assets');
    const path = `portal/${settingKey}-${ts}-${file.filename}`;
    const { error: uploadErr } = await supabase.storage
      .from('event-files')
      .upload(path, file.data, { contentType: mime, upsert: true });
    if (uploadErr) { console.error('[upload design]', uploadErr); return err('Storage upload failed: ' + uploadErr.message); }
    const { data: { publicUrl } } = supabase.storage.from('event-files').getPublicUrl(path);
    const saveErr = await savePortalSettings(supabase, { [settingKey]: publicUrl });
    if (saveErr) return err('Settings save failed: ' + saveErr.message);
    return ok({ url: publicUrl, name: file.filename });
  }

  // Event file
  if (!eventId) return err('eventId required');
  const fieldMap = { client_logo: 'client_logo_url', organiser_logo: 'organiser_logo_url', manual: 'manual_url' };
  const field = fieldMap[type];
  if (!field) return err('Unknown type: ' + type);

  const folder = type === 'manual' ? 'manuals' : 'logos';
  const path = `${folder}/${eventId}-${ts}-${file.filename}`;
  const { error: uploadErr } = await supabase.storage
    .from('event-files')
    .upload(path, file.data, { contentType: mime, upsert: true });
  if (uploadErr) { console.error('[upload event]', uploadErr); return err('Storage upload failed: ' + uploadErr.message); }

  const { data: { publicUrl } } = supabase.storage.from('event-files').getPublicUrl(path);
  const update = { [field]: publicUrl };
  if (type === 'manual') update.manual_name = file.filename;

  const { error: dbErr } = await supabase.from('events').update(update).eq('id', eventId);
  if (dbErr) { console.error('[upload db]', dbErr); return err('DB update failed: ' + dbErr.message); }

  return ok({ url: publicUrl, name: file.filename });
};

function parseMultipart(buffer, boundary) {
  const parts = [];
  const sep = Buffer.from('--' + boundary);
  let pos = 0;
  while (pos < buffer.length) {
    const bPos = indexOf(buffer, sep, pos);
    if (bPos === -1) break;
    pos = bPos + sep.length;
    if (buffer[pos] === 45 && buffer[pos + 1] === 45) break;
    if (buffer[pos] === 13) pos += 2;
    const hEnd = indexOf(buffer, Buffer.from('\r\n\r\n'), pos);
    if (hEnd === -1) break;
    const headers = buffer.slice(pos, hEnd).toString();
    pos = hEnd + 4;
    const next = indexOf(buffer, sep, pos);
    const dataEnd = next === -1 ? buffer.length : next - 2;
    parts.push({
      name:     headers.match(/name="([^"]+)"/)?.[1],
      filename: headers.match(/filename="([^"]+)"/)?.[1],
      mimetype: headers.match(/Content-Type:\s*([^\r\n]+)/i)?.[1]?.trim(),
      data:     buffer.slice(pos, dataEnd),
    });
    pos = next === -1 ? buffer.length : next;
  }
  return parts;
}

function indexOf(buf, search, start = 0) {
  for (let i = start; i <= buf.length - search.length; i++) {
    let found = true;
    for (let j = 0; j < search.length; j++) if (buf[i + j] !== search[j]) { found = false; break; }
    if (found) return i;
  }
  return -1;
}
```

- [ ] **Step 2: Verify + commit**

```bash
node -e "require('./netlify/functions/upload.js'); console.log('OK')" && \
git add netlify/functions/upload.js && \
git commit -m "feat: rewrite upload.js to use Supabase storage (real URLs, not base64)"
```

---

## Task 8: Backend — design.js

**Files:**
- Rewrite: `netlify/functions/design.js`

- [ ] **Step 1: Write design.js**

```js
const { db, verifyToken, ok, err, cors, getPortalSettings, savePortalSettings } = require('./_shared');

const DEFAULTS = {
  primary_color: '#d42b2b',
  accent_color: '#f5c800',
  text_color: '#ffffff',
  button_style: 'rounded',
  logo_size: '120',
  heading_text: 'IMPI Safety Induction Portal',
  subtitle_text: 'Complete your safety induction before accessing the event.',
  impi_logo_url: '',
  hero_image_url: ''
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();

  const supabase = db();

  if (event.httpMethod === 'GET') {
    const settings = await getPortalSettings(supabase);
    return ok({ ...DEFAULTS, ...settings });
  }

  if (event.httpMethod === 'POST') {
    const user = verifyToken(event);
    if (!user) return err('Unauthorized', 401);
    let settings;
    try { settings = JSON.parse(event.body || '{}'); } catch { return err('Invalid JSON'); }
    const error = await savePortalSettings(supabase, settings);
    if (error) { console.error('[design POST]', error); return err(error.message); }
    return ok({ success: true });
  }

  return err('Method not allowed', 405);
};
```

- [ ] **Step 2: Verify + commit**

```bash
node -e "require('./netlify/functions/design.js'); console.log('OK')" && \
git add netlify/functions/design.js && \
git commit -m "feat: rewrite design.js with dual-format settings adapter and defaults"
```

---

## Task 9: Backend — settings.js + topics.js

**Files:**
- Rewrite: `netlify/functions/settings.js`
- Create: `netlify/functions/topics.js`

- [ ] **Step 1: Write settings.js**

```js
const { db, verifyToken, ok, err, cors, hashStr, retry } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();
  const user = verifyToken(event);
  if (!user) return err('Unauthorized', 401);
  const supabase = db();

  if (event.httpMethod === 'GET') {
    const action = event.queryStringParameters?.action;
    if (action === 'listUsers') {
      const result = await retry(() =>
        supabase.from('admin_users').select('id,name,email,role').order('created_at')
      );
      return ok({ users: result.data || [] });
    }
    return err('Unknown action');
  }

  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return err('Invalid JSON'); }
    const { action } = body;

    if (action === 'changePassword') {
      if (user.role !== 'admin') return err('Admin only', 403);
      const { newPassword } = body;
      if (!newPassword || newPassword.length < 6) return err('Password must be at least 6 characters');
      const hashed = hashStr(newPassword);
      await supabase.from('admin_users').update({ password: hashed }).eq('email', 'admin@impi');
      return ok({ success: true });
    }

    if (action === 'addUser') {
      if (user.role !== 'admin') return err('Admin only', 403);
      const { name, email, password, role } = body;
      if (!name || !email || !password) return err('name, email, password required');
      const hashed = hashStr(password);
      const result = await retry(() =>
        supabase.from('admin_users').insert([{ name, email: email.toLowerCase(), password: hashed, password_hash: hashed, role: role || 'staff' }])
      );
      if (result.error) return err(result.error.message);
      return ok({ success: true });
    }

    if (action === 'updateUserRole') {
      if (user.role !== 'admin') return err('Admin only', 403);
      const { userId, role } = body;
      if (!userId || !role) return err('userId and role required');
      const result = await retry(() =>
        supabase.from('admin_users').update({ role }).eq('id', userId)
      );
      if (result.error) return err(result.error.message);
      return ok({ success: true });
    }

    if (action === 'resetUserPw') {
      if (user.role !== 'admin') return err('Admin only', 403);
      const { userId, newPassword } = body;
      if (!userId || !newPassword) return err('userId and newPassword required');
      const hashed = hashStr(newPassword);
      await supabase.from('admin_users').update({ password: hashed, password_hash: hashed }).eq('id', userId);
      return ok({ success: true });
    }

    if (action === 'removeUser') {
      if (user.role !== 'admin') return err('Admin only', 403);
      const { userId } = body;
      if (!userId) return err('userId required');
      const result = await retry(() => supabase.from('admin_users').delete().eq('id', userId));
      if (result.error) return err(result.error.message);
      return ok({ success: true });
    }

    return err('Unknown action');
  }

  return err('Method not allowed', 405);
};
```

- [ ] **Step 2: Write topics.js**

Default topics if none saved for the event (7 topics matching standard IMPI induction).

```js
const { db, verifyToken, ok, err, cors, retry } = require('./_shared');

const DEFAULT_TOPICS = [
  { id:'t1', topic_order:1, title:'Safety File & Accreditation', description:'All contractors and service providers must have a valid safety file on site. Health & Safety representatives must be clearly identified and accessible at all times.', correct_answer:'I understand and will ensure my safety file is on site.', wrong_answer:'I do not need a safety file for this event.' },
  { id:'t2', topic_order:2, title:'Personal Protective Equipment (PPE)', description:'Appropriate PPE must be worn at all times in designated areas. Hard hats, reflective vests, safety boots and gloves are required in build-up and breakdown zones.', correct_answer:'I will wear the required PPE in all designated areas.', wrong_answer:'PPE is optional and only worn when I feel it is necessary.' },
  { id:'t3', topic_order:3, title:'Emergency Procedures & Exits', description:'Familiarise yourself with all emergency exits, assembly points and evacuation routes. In an emergency: stay calm, do not run, follow marshals\' instructions and proceed to the nearest assembly point.', correct_answer:'I know the emergency exits and will follow evacuation procedures.', wrong_answer:'I will decide my own exit route during an emergency.' },
  { id:'t4', topic_order:4, title:'Fire Safety', description:'No open flames or unauthorised heat sources are permitted. Know the location of fire extinguishers. Do not obstruct fire hose reels, extinguishers or fire exits at any time.', correct_answer:'I will not obstruct fire safety equipment and will follow fire procedures.', wrong_answer:'Fire safety equipment can be moved if it is in my way.' },
  { id:'t5', topic_order:5, title:'Working at Heights', description:'Any work above 1.5 metres requires appropriate fall protection. Scaffolding and elevated platforms must be inspected before use. Never work at heights without an approved harness and anchor point.', correct_answer:'I will use approved fall protection for any work above 1.5 metres.', wrong_answer:'I can use any available structure as a working platform.' },
  { id:'t6', topic_order:6, title:'Electrical Safety', description:'Only qualified electricians may work on electrical installations. Do not overload power circuits. Report exposed wiring, damaged equipment or sparking immediately to the safety officer.', correct_answer:'I will report any electrical hazards immediately and not attempt repairs myself.', wrong_answer:'Minor electrical issues can be fixed by anyone on site.' },
  { id:'t7', topic_order:7, title:'Housekeeping & Waste Management', description:'Maintain a clean and tidy workspace at all times. All waste must be correctly sorted and disposed of in designated areas. Passageways and emergency routes must remain clear at all times.', correct_answer:'I will keep my workspace clean and dispose of waste correctly.', wrong_answer:'Waste can be left on site for others to clear.' }
];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();
  const supabase = db();

  if (event.httpMethod === 'GET') {
    const eventId = event.queryStringParameters?.eventId;

    // 1. Try event-specific topics
    if (eventId) {
      const result = await retry(() =>
        supabase.from('induction_topics').select('*').eq('event_id', eventId).order('topic_order')
      );
      if (!result.error && result.data?.length > 0) return ok(result.data);
    }

    // 2. Try global topics (event_id = 'global')
    const globalResult = await retry(() =>
      supabase.from('induction_topics').select('*').eq('event_id', 'global').order('topic_order')
    );
    if (!globalResult.error && globalResult.data?.length > 0) return ok(globalResult.data);

    // 3. Hardcoded defaults
    return ok(DEFAULT_TOPICS);
  }

  const user = verifyToken(event);
  if (!user) return err('Unauthorized', 401);

  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return err('Invalid JSON'); }
    const { eventId, topics } = body;
    if (!eventId) return err('eventId required');
    if (!Array.isArray(topics)) return err('topics must be an array');

    // Replace all topics for this event/global scope
    await supabase.from('induction_topics').delete().eq('event_id', eventId);
    if (topics.length > 0) {
      const rows = topics.map((t, i) => ({
        event_id: eventId,
        topic_order: t.topic_order ?? i + 1,
        title: t.title,
        description: t.description,
        correct_answer: t.correct_answer,
        wrong_answer: t.wrong_answer
      }));
      const { error } = await supabase.from('induction_topics').insert(rows);
      if (error) { console.error('[topics POST]', error); return err(error.message); }
    }
    return ok({ success: true });
  }

  if (event.httpMethod === 'DELETE') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return err('Invalid JSON'); }
    const { eventId } = body;
    if (!eventId) return err('eventId required');
    await supabase.from('induction_topics').delete().eq('event_id', eventId);
    return ok({ success: true });
  }

  return err('Method not allowed', 405);
};
```

- [ ] **Step 3: Verify + commit**

```bash
node -e "require('./netlify/functions/settings.js'); require('./netlify/functions/topics.js'); console.log('OK')" && \
git add netlify/functions/settings.js netlify/functions/topics.js && \
git commit -m "feat: rewrite settings.js, create topics.js with 7 default topics and global fallback"
```

---

## Task 10: SQL Database Migrations

Run these in Supabase SQL editor (safe — all additive or idempotent):

- [ ] **Step 1: Run migrations in Supabase SQL editor**

```sql
-- Column additions (safe, additive)
ALTER TABLE events ADD COLUMN IF NOT EXISTS hss_contact TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS hss_num TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS organiser_logo_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE completions ADD COLUMN IF NOT EXISTS id_type TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'staff';

-- Disable RLS (data already protected by service key)
ALTER TABLE portal_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE completions DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE induction_topics DISABLE ROW LEVEL SECURITY;

-- Storage policies
DROP POLICY IF EXISTS "Allow all uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow deletes" ON storage.objects;
CREATE POLICY "Allow all uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'event-files');
CREATE POLICY "Allow public reads" ON storage.objects FOR SELECT USING (bucket_id = 'event-files');
CREATE POLICY "Allow updates" ON storage.objects FOR UPDATE USING (bucket_id = 'event-files');
CREATE POLICY "Allow deletes" ON storage.objects FOR DELETE USING (bucket_id = 'event-files');

-- Duplicate detection index
CREATE INDEX IF NOT EXISTS idx_completions_dup ON completions (LOWER(full_name), LOWER(surname), event_id);
```

- [ ] **Step 2: Verify event-files storage bucket exists**

In Supabase dashboard → Storage → confirm `event-files` bucket exists. If not, create it as a **public** bucket.

---

## Task 11: public/verify.html

**Files:**
- Rewrite: `public/verify.html`

Complete dark-themed verification page with QR scanner.

- [ ] **Step 1: Write public/verify.html**

Full page structure:
- `<head>`: Google Fonts (Montserrat + Inter), inline CSS with dark theme variables
- `<body>`: sticky nav (IMPI logo, "Back to Portal" link), hero section (dark bg, cert code input, Check button, QR scan button), result section (conditionally shown)

CSS variables for dark theme:
```css
:root {
  --bg: #0a0b0e; --surface: #13151a; --surface2: #1c1f28;
  --border: rgba(255,255,255,0.08); --text: #f1f5f9;
  --muted: rgba(255,255,255,0.45); --red: #d42b2b;
  --yellow: #f5c800; --green: #22c55e; --green-bg: rgba(34,197,94,0.12);
  --fh: 'Montserrat',sans-serif; --fb: 'Inter',sans-serif;
}
```

JavaScript:
```js
// jsQR CDN with 3 fallbacks
const JSQR_CDNS = [
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
  'https://unpkg.com/jsqr@1.4.0/dist/jsQR.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jsqr/1.4.0/jsQR.js'
];

async function loadJsQR() {
  for (const url of JSQR_CDNS) {
    try {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = url;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
      if (window.jsQR) return true;
    } catch {}
  }
  return false;
}

// QR scanner logic
let scanInterval, stream;
async function startQrScan() {
  const loaded = await Promise.race([
    loadJsQR(),
    new Promise(r => setTimeout(() => r(false), 5000))
  ]);
  if (!loaded) { showScanError('QR scanner could not load'); return; }

  stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  const video = document.getElementById('qrVideo');
  video.srcObject = stream;

  video.addEventListener('canplay', startScanning, { once: true });
  setTimeout(startScanning, 1500); // fallback timer
}

function startScanning() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const video = document.getElementById('qrVideo');
  if (scanInterval) return;

  scanInterval = setInterval(() => {
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Try normal then inverted
    let result = jsQR(imageData.data, imageData.width, imageData.height);
    if (!result) {
      const inv = new Uint8ClampedArray(imageData.data);
      for (let i = 0; i < inv.length; i += 4) { inv[i] = 255 - inv[i]; inv[i+1] = 255 - inv[i+1]; inv[i+2] = 255 - inv[i+2]; }
      result = jsQR(inv, imageData.width, imageData.height);
    }

    if (result?.data) {
      stopCamera();
      // Parse IMPIVERT:code:name:eventId or plain cert code
      const parts = result.data.split(':');
      const code = parts[0] === 'IMPIVERT' ? parts[1] : result.data;
      document.getElementById('codeInput').value = code.toUpperCase();
      checkCert();
    }
  }, 150);
}

function stopCamera() {
  clearInterval(scanInterval); scanInterval = null;
  stream?.getTracks().forEach(t => t.stop());
  document.getElementById('scannerSection').style.display = 'none';
}

async function checkCert() {
  const code = document.getElementById('codeInput').value.trim().toUpperCase();
  if (!code) return;
  showLoading(true);
  try {
    const res = await fetch(`/api/verify?code=${encodeURIComponent(code)}`);
    const data = await res.json();
    showResult(data);
  } catch {
    showResult({ valid: false, message: 'Connection error — please try again.' });
  } finally {
    showLoading(false);
  }
}

// Auto-uppercase cert code input
document.getElementById('codeInput').addEventListener('input', e => {
  const sel = e.target.selectionStart;
  e.target.value = e.target.value.toUpperCase();
  e.target.setSelectionRange(sel, sel);
});
```

Design for result display:
- Valid: green card with checkmark, name, company, role, ID type + number, event name, completed date
- Invalid: red card with X, "Certificate not found" message

- [ ] **Step 2: Implement and verify**

```bash
netlify dev
# Open http://localhost:8888/verify
# Test with an invalid code — should show red "not found"
# Test with a real cert code from DB — should show green result
```

- [ ] **Step 3: Commit**

```bash
git add public/verify.html && git commit -m "feat: rebuild verify.html with dark theme, QR scanner, jsQR CDN fallbacks"
```

---

## Task 12: public/admin-login.html

**Files:**
- Create: `public/admin-login.html`

Standalone, noindex login page. Redirects to admin.html on success.

- [ ] **Step 1: Write public/admin-login.html**

Full self-contained page (200–300 lines). Key features:
- `<meta name="robots" content="noindex,nofollow">` in head
- White centred card on `#F7F8FA` background
- IMPI logo from `sessionStorage.getItem('impi_logo')` or generic text fallback
- Optional email field (for team users), password field, Sign In button
- On load: if sessionStorage has valid `impi_admin_token`, redirect to admin.html immediately
- On success: store token, role, name in sessionStorage and redirect to admin.html
- Error shown in red below form

```js
// On page load
if (sessionStorage.getItem('impi_admin_token')) location.href = '/admin.html';

// Load logo from design settings
fetch('/api/design').then(r => r.json()).then(d => {
  if (d.impi_logo_url) {
    document.getElementById('loginLogo').src = d.impi_logo_url;
    document.getElementById('loginLogo').style.display = 'block';
    document.getElementById('loginLogoText').style.display = 'none';
    sessionStorage.setItem('impi_logo', d.impi_logo_url);
  }
}).catch(() => {});

async function login() {
  const email = document.getElementById('emailInput').value.trim();
  const password = document.getElementById('pwInput').value;
  if (!password) { showError('Enter your password.'); return; }
  setBusy(true);
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email || undefined, password })
    });
    const data = await res.json();
    if (data.success) {
      sessionStorage.setItem('impi_admin_token', data.token);
      sessionStorage.setItem('impi_admin_role', data.role || 'staff');
      sessionStorage.setItem('impi_admin_name', data.name || 'Admin');
      location.href = '/admin.html';
    } else {
      showError(data.message || 'Login failed.');
    }
  } catch {
    showError('Connection error — please try again.');
  } finally {
    setBusy(false);
  }
}
```

- [ ] **Step 2: Verify**

```bash
netlify dev
# Open http://localhost:8888/admin-login.html
# Try wrong password — should show error
# Try IMPI@Admin2026 — should redirect to admin.html
```

- [ ] **Step 3: Commit**

```bash
git add public/admin-login.html && git commit -m "feat: create admin-login.html standalone page"
```

---

## Task 13: public/index.html — Landing Page

**Files:**
- Rewrite: `public/index.html`

Full light-theme landing page. ~800 lines.

- [ ] **Step 1: Write public/index.html with complete structure**

HEAD includes:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
```

CSS: ALL design system variables from spec:
```css
:root {
  --bg: #F7F8FA; --surface: #FFFFFF; --surface2: #F0F2F6;
  --border: #E2E6EE; --text-primary: #0F1623; --text-secondary: #4B5563;
  --text-muted: #9CA3AF; --accent-red: #D42B2B; --accent-red-light: #FEF2F2;
  --accent-yellow: #F5C800; --accent-yellow-light: #FFFBEB;
  --green: #16A34A; --green-light: #DCFCE7; --blue: #2563EB; --blue-light: #DBEAFE;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04);
  --shadow-lg: 0 16px 48px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06);
  --radius-sm: 6px; --radius-md: 10px; --radius-lg: 16px; --radius-xl: 24px;
  --fh: 'Montserrat', sans-serif; --fb: 'Inter', sans-serif;
}
```

HTML structure (top to bottom):

**1. STICKY NAV** — white bar, shadow-sm, IMPI logo left, "🔍 Verify Certificate" button right. No admin link.

**2. HERO** — full viewport, dark gradient `linear-gradient(160deg, #0f1623 0%, #1a0505 50%, #260808 100%)` with optional hero image background (from design settings, with `rgba(0,0,0,0.55)` overlay). Center: IMPI logo (dynamic size from `logo_size` setting), h1 heading, subtitle, scroll indicator.

**3. INFO STRIP** — 4-card row on white surface:
```html
<div class="info-strip">
  <div class="info-card"><span class="info-icon">⏱️</span><span class="info-label">Duration</span><span class="info-val">10–15 min</span></div>
  <div class="info-card"><span class="info-icon">📋</span><span class="info-label">Topics</span><span class="info-val">7 Safety Topics</span></div>
  <div class="info-card"><span class="info-icon">🪪</span><span class="info-label">Required</span><span class="info-val">ID Number</span></div>
  <div class="info-card"><span class="info-icon">🏆</span><span class="info-label">You Receive</span><span class="info-val">Certificate</span></div>
</div>
```

**4. EVENTS SECTION** — `id="eventsSection"`:
- "Select Your Event" h2
- Event cards grid (`display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`)
- Each card: client logo or placeholder icon, event name, venue, date range, status badge, action button
- Status badges: Draft=blue, Active=green, Completed=grey; Archived events hidden
- Click → shows EVENT DETAIL VIEW (replaces events section, does NOT navigate away)

**5. EVENT DETAIL VIEW** — `id="eventDetail"` (hidden initially):
- Back button → returns to events grid
- Event name (first word in `--accent-red`)
- 4-item date strip (Build-Up, Event, Breakdown, Organiser)
- Status notice if draft ("Coming Soon") or completed ("Event Closed")
- 3 action cards:
  - Online Induction → `/induction.html?event=${id}` (disabled for draft/completed)
  - Download Manual → only if `manual_url` set
  - Verify Certificate → `/verify.html`

**6. TOPICS SECTION** — always visible, 8 topic items in 2-col grid with yellow `✓` icons. Static content.

**7. FOOTER** — logo, copyright `© 2026 IMPI Safety Services International`, Verify link. NO admin link.

JavaScript (app state + API calls):
```js
let allEvents = [], currentEvent = null;
let designSettings = {};

async function init() {
  // Load design settings first
  try {
    const res = await fetch('/api/design');
    designSettings = await res.json();
    applyDesignSettings(designSettings);
  } catch {}

  // Load events
  try {
    const res = await fetch('/api/events');
    allEvents = await res.json();
    renderEvents(allEvents.filter(e => e.status !== 'archived'));
  } catch {
    document.getElementById('eventsGrid').innerHTML = '<p class="empty-state">Could not load events.</p>';
  }
}

function applyDesignSettings(d) {
  const logoEls = document.querySelectorAll('.site-logo');
  const logoSize = parseInt(d.logo_size) || 120;
  logoEls.forEach(el => {
    if (d.impi_logo_url) { el.src = d.impi_logo_url; el.style.display = 'block'; }
    el.style.height = Math.min(logoSize, 80) + 'px'; // nav cap 80px
  });
  const heroLogo = document.getElementById('heroLogo');
  if (heroLogo) {
    if (d.impi_logo_url) { heroLogo.src = d.impi_logo_url; heroLogo.style.display = 'block'; }
    heroLogo.style.height = logoSize + 'px';
  }
  if (d.hero_image_url) {
    document.getElementById('hero').style.backgroundImage = `url('${d.hero_image_url}')`;
  }
  document.getElementById('heroTitle').textContent = d.heading_text || 'IMPI Safety Induction Portal';
  document.getElementById('heroSubtitle').textContent = d.subtitle_text || 'Complete your safety induction before accessing the event.';
  if (d.primary_color) {
    document.documentElement.style.setProperty('--accent-red', d.primary_color);
  }
}

function renderEvents(events) {
  const grid = document.getElementById('eventsGrid');
  if (!events.length) {
    grid.innerHTML = '<div class="empty-events"><span>📅</span><p>No active events at this time.</p></div>';
    return;
  }
  grid.innerHTML = events.map(ev => `
    <div class="event-card" onclick="showEventDetail('${ev.id}')">
      <div class="event-card-logo">
        ${ev.client_logo_url ? `<img src="${ev.client_logo_url}" alt="${ev.name}">` : `<div class="event-card-icon">🏟️</div>`}
      </div>
      <div class="event-card-body">
        <div class="event-card-status">${statusBadge(ev.status)}</div>
        <h3 class="event-card-name">${ev.name}</h3>
        <div class="event-card-meta">📍 ${ev.venue || 'Venue TBC'}</div>
        <div class="event-card-meta">📅 ${formatDateRange(ev.ev_start, ev.ev_end)}</div>
      </div>
      <div class="event-card-action">
        <button class="btn-primary ${ev.status !== 'active' ? 'btn-disabled' : ''}">${ev.status === 'active' ? 'Start Induction →' : ev.status === 'draft' ? 'Coming Soon' : 'Event Closed'}</button>
      </div>
    </div>
  `).join('');
}

function statusBadge(status) {
  const map = { draft: ['blue','Draft'], active: ['green','Active'], completed: ['grey','Completed'], archived: ['grey','Archived'] };
  const [color, label] = map[status] || ['grey', status];
  return `<span class="badge badge-${color}">${label}</span>`;
}

function showEventDetail(id) {
  currentEvent = allEvents.find(e => e.id === id);
  if (!currentEvent) return;
  document.getElementById('eventsSection').style.display = 'none';
  document.getElementById('eventDetail').style.display = 'block';
  renderEventDetail(currentEvent);
  window.scrollTo({ top: document.getElementById('eventDetail').offsetTop - 80, behavior: 'smooth' });
}

function renderEventDetail(ev) {
  const isActive = ev.status === 'active';
  document.getElementById('detailName').innerHTML = ev.name.replace(/^(\S+)/, '<span style="color:var(--accent-red)">$1</span>');
  document.getElementById('detailVenue').textContent = ev.venue || '';
  // Date strip, action cards, etc.
  document.getElementById('inductionBtn').href = isActive ? `/induction.html?event=${ev.id}` : '#';
  document.getElementById('inductionBtn').className = isActive ? 'action-card' : 'action-card action-card-disabled';
}

document.addEventListener('DOMContentLoaded', init);
```

- [ ] **Step 2: Run and visually verify**

```bash
netlify dev
# Open http://localhost:8888
# Verify: light theme renders, logo loads, events grid appears
# Click an event — detail view appears
# Check hero, info strip, topics section, footer
# Confirm NO admin link anywhere
```

- [ ] **Step 3: Commit**

```bash
git add public/index.html && git commit -m "feat: rebuild index.html with light theme, event grid, design settings"
```

---

## Task 14: public/induction.html — Induction Questionnaire

**Files:**
- Rewrite: `public/induction.html`

This is the most complex page (~2000 lines). Complete it as a single self-contained HTML file.

- [ ] **Step 1: Write the complete page structure**

HEAD: Fonts (Montserrat + Inter). No external JS dependencies except QR code generation.

QR code library:
```html
<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
```

CSS: Light theme with `--accent-red` as the event's primary color (overridden from event data).

Full HTML structure:
1. **Nav** — sticky white bar: IMPI logo (design_settings logo_size, max 56px in nav), event name, language switcher, back + home buttons
2. **Banner** — gradient using event's `color_primary` or `--accent-red`. IMPI logo left, client logo right (shown if `client_logo_url` set)
3. **Progress bar** — horizontal scroll, generated dynamically: `Info → [Topic 1..N] → Legal → Certificate`
4. **Step content wrapper** — `max-width: 720px; margin: 0 auto`

**STEP 0 — Induction Type:**
```html
<div class="type-card" onclick="selectType('individual')" id="typeIndividual">
  <div class="type-icon">👤</div>
  <div class="type-label">Individual</div>
  <div class="type-sub">Just yourself</div>
</div>
<div class="type-card" onclick="selectType('group')" id="typeGroup">
  <div class="type-icon">👥</div>
  <div class="type-label">Group</div>
  <div class="type-sub">You + team members</div>
</div>
<!-- Group size selector (shown when group selected) -->
<div id="groupSizeWrap" style="display:none">
  <label>Number of additional team members (not including yourself)</label>
  <select id="groupSizeSelect" onchange="buildGroupRows()">
    <option value="">Select...</option>
    <!-- Options 1-35 generated by JS -->
  </select>
  <!-- Dynamic team member rows injected here by buildGroupRows() -->
</div>
```

**STEP 1 — Personal Info:**
Fields (all required): Email, Role (select), First Name, Surname, ID Type (dropdown), ID Number, Phone, Company Name, Trade/Occupation.

ID Type dropdown options:
```
SA ID 🇿🇦 | Passport 🌍 | NIN Nigeria 🇳🇬 | National ID Kenya 🇰🇪 | Employee No 🏢 | Other 📋
```

POPIA notice box above the form.

**STEP 2 to N — Topics:**
Generated dynamically from `topics` array loaded from `/api/topics?eventId=`. Each topic:
```html
<div class="topic-header" style="background: var(--event-primary)">
  <span class="topic-num">Topic ${i+1}</span>
  <span class="topic-title">${topic.title}</span>
</div>
<div class="topic-body">${topic.description}</div>
<div class="quiz-options">
  <button class="quiz-opt quiz-correct" onclick="answerTopic(${i}, 'correct')">
    <span class="quiz-tick">✓</span> ${topic.correct_answer}
  </button>
  <button class="quiz-opt quiz-wrong" onclick="answerTopic(${i}, 'wrong')">
    <span class="quiz-x">✗</span> ${topic.wrong_answer}
  </button>
</div>
```

`answerTopic(i, answer)`: if 'wrong', shake animation + reset after 1500ms. If 'correct', mark done + advance next step.

**LEGAL STEP:**
5 checkboxes, all required to proceed:
1. I confirm all provided information is accurate and truthful.
2. I agree to comply with all safety rules and regulations at this event.
3. I understand that non-compliance may result in removal from the premises.
4. I have read and understood all safety topics covered in this induction.
5. I acknowledge that my certificate will be verified at the venue entrance.

Emergency contacts box below checkboxes (from event data):
```html
<div class="emergency-contacts">
  <div class="ec-title">🚨 Emergency Contacts</div>
  <div class="ec-grid">
    <div class="ec-item"><span class="ec-label">Safety Manager</span><span class="ec-name">${event.safety_mgr}</span><a href="tel:${event.safety_num}">${event.safety_num}</a></div>
    <div class="ec-item"><span class="ec-label">Security</span><span class="ec-name">${event.sec_mgr}</span><a href="tel:${event.sec_num}">${event.sec_num}</a></div>
    <div class="ec-item"><span class="ec-label">HSS Contact</span><span class="ec-name">${event.hss_contact}</span><a href="tel:${event.hss_num}">${event.hss_num}</a></div>
    <div class="ec-item"><span class="ec-label">Ambulance</span><a href="tel:${event.amb_num}">${event.amb_num}</a></div>
  </div>
</div>
```

**CERT GENERATION:**
```js
async function generateCertificates() {
  const people = buildPeopleList(); // inductor + group members
  const results = [];

  for (let i = 0; i < people.length; i++) {
    updateProgress(`Generating certificate ${i + 1} of ${people.length}...`);

    // 1. Check duplicate
    const dupCheck = await checkDuplicate(people[i]);
    if (dupCheck.alreadyCompleted) {
      results.push({ ...people[i], cert_code: dupCheck.existingCode, skipped: true });
      continue;
    }
    if (dupCheck.isDuplicate) {
      showDuplicateModal(people[i].full_name + ' ' + people[i].surname, i, people.length);
      return; // Stop everything
    }

    // 2. Generate cert code
    const certCode = makeCertCode(people[i].full_name, people[i].id_number);

    // 3. Save — retry 3 times
    let saved = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch('/api/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...people[i], cert_code: certCode, event_id: eventId, completed_at: new Date().toISOString() })
        });
        const data = await res.json();
        if (data.success) { saved = true; results.push({ ...people[i], cert_code: certCode }); break; }
      } catch {}
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
    }
    if (!saved) { showSaveError(people[i].full_name, i); return; }
  }

  // Send email for group (single email with all codes)
  if (people.length > 1) {
    fetch('/api/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...people[0], cert_code: results[0].cert_code, event_id: eventId,
        is_group: true, group_members: results.slice(1)
      })
    }).catch(() => {});
  }

  showCertificateStep(results);
}
```

**CERTIFICATE DISPLAY:**
- Individual: single cert card
- Group: scrollable list, inductor first with "👑 Team Leader" badge

Each cert card contains:
```html
<div class="cert-card" id="cert-${code}">
  <div class="cert-header">
    <img class="cert-logo-left" src="${impiLogoUrl}" alt="IMPI">
    ${eventLogoUrl ? `<img class="cert-logo-right" src="${eventLogoUrl}" alt="Event Logo">` : ''}
  </div>
  <div class="cert-body">
    ${isInductor ? '<div class="inductor-badge">👑 Team Leader</div>' : ''}
    <div class="cert-verified-badge">✓ Verified & Active</div>
    <h2 class="cert-name">${fullName} ${surname}</h2>
    <div class="cert-detail">${idType}: ${idNumber}</div>
    <div class="cert-detail">${role} · ${company}</div>
    <div class="cert-detail">${trade}</div>
    <div class="cert-date">Completed: ${formatDate(completedAt)}</div>
    <div class="cert-event">${eventName}</div>
    <div class="cert-organiser">
      <span class="cert-organised-by">Organised by</span>
      ${organiserLogoUrl ? `<img src="${organiserLogoUrl}" alt="Organiser">` : eventOrganiser}
    </div>
    <div class="cert-code-section">
      <div class="cert-code">${certCode}</div>
      <div id="qr-${certCode}" class="qr-code"></div>
    </div>
  </div>
  <div class="cert-actions">
    <button onclick="copyCertCode('${certCode}')">📋 Copy Code</button>
    <button onclick="shareCert('${certCode}', '${fullName}')">📤 Share</button>
    <button onclick="resendEmail('${certCode}')">📧 Resend Email</button>
    <button onclick="window.print()">🖨️ Print</button>
  </div>
</div>
```

QR code generation for each cert (encode `IMPIVERT:${certCode}:${name}:${eventId}`):
```js
QRCode.toCanvas(document.getElementById(`qr-${certCode}`), `IMPIVERT:${certCode}:${name}:${eventId}`, { width: 100, margin: 1 });
```

Print styles: `@media print { .cert-card { page-break-after: always; } .nav, .banner, .progress, .cert-actions { display: none; } }`

**LANGUAGE SYSTEM:**
Full translations object for EN, AF, ZU, SW, FR, PT, HA, YO — all 8 languages.
```js
const LANGS = {
  EN: { name:'English', flag:'🇬🇧', t: { step_info:'Personal Information', ... } },
  AF: { name:'Afrikaans', flag:'🇿🇦', t: { step_info:'Persoonlike Inligting', ... } },
  ZU: { name:'isiZulu', flag:'🇿🇦', t: { ... } },
  // ... all 8
};

function t(key) { return (LANGS[currentLang]?.t || LANGS.EN.t)[key] || key; }
function setLang(code) {
  currentLang = code;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    el.textContent = t(key);
  });
}
```

All UI text in the page uses `data-i18n="key"` attributes.

- [ ] **Step 2: Verify**

```bash
netlify dev
# Open http://localhost:8888/induction.html?event=<real-event-id>
# Walk through: Individual flow, fill form, answer all topics, check legal, generate cert
# Walk through: Group flow (2 members), generate 2 certs
# Test language switcher (EN → AF → ZU)
# Test print (CMD+P) — only cert shows
# Test QR code appears on cert
```

- [ ] **Step 3: Commit**

```bash
git add public/induction.html && git commit -m "feat: rebuild induction.html with light theme, group support, 8 languages, QR certs"
```

---

## Task 15: public/admin.html — Full Admin Dashboard (All 6 Tabs)

**Files:**
- Rewrite: `public/admin.html`

Full rebuild. ~2500 lines. Light theme matching spec.

- [ ] **Step 1: Write complete admin.html**

Inline login (shown when not authenticated). On auth, stores token + role in sessionStorage.

**Layout:**
```html
<!-- Login overlay -->
<div id="loginWrap">...</div>

<!-- Dashboard (hidden until logged in) -->
<div id="appWrap" style="display:none">
  <aside class="sidebar">
    <div class="sidebar-logo">
      <img class="site-logo" alt="IMPI" style="height:32px">
      <span class="sidebar-brand">IMPI Admin</span>
    </div>
    <nav class="sidebar-nav">
      <button class="nav-item active" onclick="showTab('dashboard')">📊 Dashboard</button>
      <button class="nav-item" onclick="showTab('events')">📅 Events</button>
      <button class="nav-item" onclick="showTab('completions')">🏆 Completions</button>
      <button class="nav-item" onclick="showTab('topics')">📝 Induction Content</button>
      <button class="nav-item" onclick="showTab('design')">🎨 Design</button>
      <button class="nav-item" onclick="showTab('settings')">⚙️ Settings</button>
    </nav>
    <div class="sidebar-footer">
      <button class="signout-btn" onclick="signOut()">Sign Out</button>
    </div>
  </aside>
  <main class="main-content">
    <div class="top-bar">
      <span id="pageTitle" class="page-title">Dashboard</span>
      <a href="/" class="top-site-link">← Live Site</a>
    </div>
    <div class="content">
      <div id="tab-dashboard" class="tab-page active">...</div>
      <div id="tab-events" class="tab-page">...</div>
      <div id="tab-completions" class="tab-page">...</div>
      <div id="tab-topics" class="tab-page">...</div>
      <div id="tab-design" class="tab-page">...</div>
      <div id="tab-settings" class="tab-page">...</div>
    </div>
  </main>
</div>
```

**TAB 1 — Dashboard:**
4 stat cards (Active Events, Total Completions, Today's Completions, Emails Sent) loaded from API.
Recent completions table (last 8): Name | Company | Event | Date | Code.

```js
async function loadDashboard() {
  const token = sessionStorage.getItem('impi_admin_token');
  const headers = { Authorization: `Bearer ${token}` };
  const [events, completions] = await Promise.all([
    fetch('/api/events', { headers }).then(r => r.json()),
    fetch('/api/completions', { headers }).then(r => r.json())
  ]);
  const activeCount = events.filter(e => e.status === 'active').length;
  const today = new Date().toISOString().split('T')[0];
  const todayCount = completions.filter(c => c.completed_at?.startsWith(today)).length;
  const emailCount = completions.filter(c => c.email_sent).length;
  document.getElementById('statActive').textContent = activeCount;
  document.getElementById('statTotal').textContent = completions.length;
  document.getElementById('statToday').textContent = todayCount;
  document.getElementById('statEmails').textContent = emailCount;
  renderRecentTable(completions.slice(0, 8));
}
```

**TAB 2 — Events:**
Two-panel layout: event list (left 280px) + editor panel (right).

Event list: sorted list of all events with status badges. "+ New Event" button at top.
Click event → opens editor. Click "+ New Event" → clears editor for new event.

Editor fields (matching spec exactly):
- Name, Venue, Organiser
- Status selector — 4 styled cards/chips: 🔵 Draft | 🟢 Active | ✅ Completed | ⚫ Archived
- Date ranges: Build-Up (start/end), Event (start/end), Breakdown (start/end)
- Safety contacts: Safety Manager (name + number), Security Manager (name + number), HSS Contact (name + number), Ambulance / Emergency number, Event Organiser Contact
- Colors: Primary, Accent, Text (color pickers + hex inputs synced)
- Logo uploads: Event Logo (client_logo), Organiser Logo (organiser_logo), Manual (PDF)

Status selector implementation:
```html
<div class="status-selector">
  <label>Event Status</label>
  <div class="status-options">
    <div class="status-opt" data-status="draft" onclick="setStatus('draft')">
      <span class="status-dot blue"></span>
      <span class="status-label">Draft</span>
      <span class="status-desc">Coming Soon — induction disabled</span>
    </div>
    <div class="status-opt selected" data-status="active" onclick="setStatus('active')">
      <span class="status-dot green"></span>
      <span class="status-label">Active</span>
      <span class="status-desc">Live — induction enabled</span>
    </div>
    <div class="status-opt" data-status="completed" onclick="setStatus('completed')">
      <span class="status-dot grey"></span>
      <span class="status-label">Completed</span>
      <span class="status-desc">Event Closed — induction disabled</span>
    </div>
    <div class="status-opt" data-status="archived" onclick="setStatus('archived')">
      <span class="status-dot dark"></span>
      <span class="status-label">Archived</span>
      <span class="status-desc">Hidden from public</span>
    </div>
  </div>
</div>
```

Upload zones: each has a drag-drop zone with preview, remove button. Upload via `multipart/form-data` POST to `/api/upload`.

Color pickers: input[type=color] + text input[type=text], kept in sync:
```js
function syncColor(colorInput, textInput) {
  colorInput.addEventListener('input', () => { textInput.value = colorInput.value; });
  textInput.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(textInput.value)) colorInput.value = textInput.value;
  });
}
```

**TAB 3 — Completions:**
Filter row: Event Dropdown | Search Input | Export CSV button.
Counter: "Showing X of Y completions" updating in real-time.
Table: # | Name | Company | Role | ID Type | ID Number | Email | Event | Date | Sent | Code | Delete.
Delete → modal: "Delete completion for [Name] ([Code])? Certificate will no longer verify."
Export: download CSV of currently visible rows.

```js
let allCompletions = [], allEventsMap = {};

async function loadCompletions() {
  const token = sessionStorage.getItem('impi_admin_token');
  const [comps, evs] = await Promise.all([
    fetch('/api/completions', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    fetch('/api/events', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
  ]);
  allCompletions = comps;
  allEventsMap = Object.fromEntries(evs.map(e => [e.id, e.name]));
  populateEventFilter(evs);
  filterAndRender();
}

function filterAndRender() {
  const eventFilter = document.getElementById('eventFilter').value;
  const search = document.getElementById('searchInput').value.toLowerCase();
  let filtered = allCompletions;
  if (eventFilter) filtered = filtered.filter(c => c.event_id === eventFilter);
  if (search) filtered = filtered.filter(c =>
    [c.full_name, c.surname, c.company, c.email, c.id_number, c.role]
      .join(' ').toLowerCase().includes(search)
  );
  document.getElementById('countDisplay').textContent = `Showing ${filtered.length} of ${allCompletions.length} completions`;
  renderCompletionsTable(filtered);
}

function exportCSV() {
  // Get currently filtered completions and download as CSV
  const eventFilter = document.getElementById('eventFilter').value;
  const search = document.getElementById('searchInput').value.toLowerCase();
  let filtered = allCompletions;
  if (eventFilter) filtered = filtered.filter(c => c.event_id === eventFilter);
  if (search) filtered = filtered.filter(c =>
    [c.full_name, c.surname, c.company, c.email, c.id_number, c.role]
      .join(' ').toLowerCase().includes(search)
  );
  const eventName = eventFilter ? (allEventsMap[eventFilter] || 'all').replace(/\s+/g,'_') : 'all';
  const date = new Date().toISOString().split('T')[0];
  const headers = ['Name','Surname','Company','Role','ID Type','ID Number','Email','Phone','Trade','Event','Completed','Email Sent','Cert Code'];
  const rows = filtered.map(c => [
    c.full_name, c.surname, c.company, c.role, c.id_type, c.id_number,
    c.email, c.phone, c.trade, allEventsMap[c.event_id]||c.event_id,
    c.completed_at, c.email_sent ? 'Yes' : 'No', c.cert_code
  ].map(v => `"${(v||'').toString().replace(/"/g,'""')}"`).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `completions_${eventName}_${date}.csv`;
  a.click();
}
```

Search input: `oninput="filterAndRender()"` for real-time filtering.

**TAB 4 — Induction Content:**
Dropdown: Global Defaults | [each event name].
"+ Add Topic" button, "💾 Save All" button.
Info box (blue tint): "Global topics apply to all events unless an event has its own custom set."

Topic cards (draggable order via ↑↓ buttons):
```html
<div class="topic-card" id="topic-${idx}">
  <div class="topic-card-header">
    <span class="topic-badge">${idx+1}</span>
    <span class="custom-indicator">${isCustom ? '⭐ Custom' : '📋 Default'}</span>
    <div class="topic-reorder">
      <button onclick="moveTopic(${idx}, -1)">↑</button>
      <button onclick="moveTopic(${idx}, 1)">↓</button>
    </div>
    <button class="delete-topic" onclick="deleteTopic(${idx})">🗑</button>
  </div>
  <div class="fg"><label>Topic Title</label><input type="text" value="${t.title}" oninput="updateTopic(${idx},'title',this.value)"></div>
  <div class="fg"><label>Description</label><textarea rows="4" oninput="updateTopic(${idx},'description',this.value)">${t.description}</textarea></div>
  <div class="fg correct"><label>✓ Correct Answer</label><input type="text" value="${t.correct_answer}" oninput="updateTopic(${idx},'correct_answer',this.value)"></div>
  <div class="fg wrong"><label>✗ Wrong Answer</label><input type="text" value="${t.wrong_answer}" oninput="updateTopic(${idx},'wrong_answer',this.value)"></div>
</div>
```

**TAB 5 — Design:**

Section 1: Logos & Images
- IMPI Logo upload: drag-drop or click, preview, remove. Saves to `portal_settings.impi_logo_url`.
- Hero Background upload: drag-drop or click, preview (60px height), remove. Saves to `portal_settings.hero_image_url`.
- Logo Size slider: range 40–220, step 5, default 120. Live preview updates logo in preview box.

Upload function for design assets:
```js
async function uploadDesignAsset(file, settingKey) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', 'design_asset');
  formData.append('eventId', 'portal');
  formData.append('settingKey', settingKey);
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionStorage.getItem('impi_admin_token')}` },
    body: formData
  });
  const data = await res.json();
  if (data.url) {
    document.getElementById(`preview-${settingKey}`).src = data.url;
    document.getElementById(`preview-${settingKey}`).style.display = 'block';
    dirtySettings[settingKey] = data.url;
  }
  return data;
}
```

Section 2: Brand Colors — 3 color pickers with synced hex inputs:
- Primary Color (`primary_color`) — used for buttons, banner
- Accent Color (`accent_color`) — highlights, ticks
- Button Text Color (`text_color`)

Section 3: Button Style — 4 clickable preview cards:
- Rounded (default, `border-radius: 8px`)
- Square (`border-radius: 0`)
- Pill (`border-radius: 100px`)
- Outlined (`background: transparent; border: 2px solid currentColor`)

Section 4: Portal Text — two inputs:
- Main Heading (`heading_text`)
- Subtitle Text (`subtitle_text`)

Section 5: "Save Design Settings" button at bottom — saves ALL settings at once.

```js
let dirtySettings = {};

async function saveDesignSettings() {
  const settings = {
    primary_color: document.getElementById('primaryColor').value,
    accent_color: document.getElementById('accentColor').value,
    text_color: document.getElementById('textColor').value,
    button_style: document.querySelector('.style-opt.selected')?.dataset.style || 'rounded',
    logo_size: document.getElementById('logoSizeSlider').value,
    heading_text: document.getElementById('headingText').value,
    subtitle_text: document.getElementById('subtitleText').value,
    ...dirtySettings // includes uploaded logo URLs
  };
  const res = await fetch('/api/design', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem('impi_admin_token')}` },
    body: JSON.stringify(settings)
  });
  const data = await res.json();
  if (data.success) showToast('Design settings saved!');
  else showToast('Save failed: ' + data.error, 'error');
}
```

**TAB 6 — Settings:**
Two sections:
1. Change Master Password (admin only): current password confirm + new password + confirm
2. Team Users table: Name | Email | Role | Actions (Change Role, Reset PW, Remove)
3. Add Team User form: Name, Email, Password, Role dropdown

Show/hide based on role (admin sees everything; staff/manager see only their own pw change).

**Shared JS utilities:**
```js
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function showTab(tab) {
  document.querySelectorAll('.tab-page').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  event.currentTarget.classList.add('active');
  document.getElementById('pageTitle').textContent = {
    dashboard: 'Dashboard', events: 'Events', completions: 'Completions',
    topics: 'Induction Content', design: 'Design', settings: 'Settings'
  }[tab];
  const loaders = { dashboard: loadDashboard, events: loadEvents, completions: loadCompletions, topics: loadTopics, design: loadDesign, settings: loadSettings };
  loaders[tab]?.();
}
```

- [ ] **Step 2: Run and verify all 6 tabs**

```bash
netlify dev
# Open http://localhost:8888/admin.html
# Login with IMPI@Admin2026
# Tab 1: Verify stats load correctly
# Tab 2: Create a test event, upload a logo, change status, save
# Tab 3: Filter by event, search, verify counter updates, export CSV
# Tab 4: Change a topic, save, reload to confirm persistence
# Tab 5: Upload a logo, change colors, save, reload — settings persist
# Tab 6: Add a test user, change role, remove user
```

- [ ] **Step 3: Commit**

```bash
git add public/admin.html && git commit -m "feat: rebuild admin.html with light theme, 6 tabs, full design tab, completions search"
```

---

## Self-Review Checklist

- [x] **Spec coverage — API:** auth ✓, events ✓, complete ✓ (group, email), completions ✓, verify ✓, upload ✓ (Supabase storage), design ✓, settings ✓, topics ✓, check-duplicate ✓
- [x] **Spec coverage — Pages:** index ✓ (light theme, design settings), induction ✓ (8 langs, group, QR cert), verify ✓ (QR scanner, CDN fallbacks), admin-login ✓, admin ✓ (6 tabs including design tab)
- [x] **Retry logic:** all API functions use `retry()` from _shared.js (3 attempts, exponential backoff)
- [x] **CORS:** all responses include CORS headers (via `ok()`, `err()`, `cors()` from _shared.js)
- [x] **No JWT:** removed `jsonwebtoken`; custom stateless token in _shared.js
- [x] **No data deletion:** migrations are all `ADD COLUMN IF NOT EXISTS`, no DROP TABLE
- [x] **Supabase storage:** upload.js writes to `event-files` bucket, returns public URLs
- [x] **portal_settings:** dual-format adapter detects key/value vs JSONB at runtime
- [x] **HSS Contact:** included in events editor (new field), displayed in legal step emergency contacts
- [x] **ID Types:** 6 options with flags in induction form
- [x] **Cert code format:** 2+3+3+2 = 8 chars as spec
- [x] **Admin login:** separate admin-login.html page
- [x] **No admin link in footer:** confirmed — footer only has Verify link
- [x] **Completions search:** real-time filter, dynamic count, CSV export
- [x] **Design tab uploads:** goes to Supabase storage → saves URL to portal_settings
- [x] **Button style:** 4 options (Rounded, Square, Pill, Outlined) in Design tab
- [x] **induction_topics table:** used by topics.js (not events.induction_content from old content.js)
- [x] **netlify.toml:** `/api/:func` → `/.netlify/functions/:func` redirect added

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-23-impi-portal-rebuild.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — Fresh subagent dispatched per task, results reviewed between tasks, fastest iteration with full context per task.

**2. Inline Execution** — Execute tasks sequentially in this session using executing-plans skill, with checkpoints for review.

**Which approach?**
