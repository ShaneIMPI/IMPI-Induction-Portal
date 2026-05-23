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

// djb2-style hash — spec: Math.imul(31,h)+charCode, abs().toString(16)+length.toString(16)
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
// Supports: key/value rows (key PK, value, updated_at) AND single-row JSONB (settings column)
async function getPortalSettings(supabase) {
  const { data: rows, error } = await supabase.from('portal_settings').select('*').limit(100);
  if (error) { console.error('[settings GET]', error.message); return {}; }
  if (!rows || rows.length === 0) return {};
  if ('key' in rows[0]) {
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  }
  if ('settings' in rows[0]) {
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
