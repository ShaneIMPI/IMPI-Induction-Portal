import bcrypt from 'bcryptjs';
import { sql, makeToken, cookie, getUser, send } from './_lib.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const okEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

async function startSession(res, u) {
  const t = await makeToken(u);
  res.setHeader('Set-Cookie', cookie(t, 14 * 24 * 3600));
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const user = await getUser(req);
      const [{ n }] = await sql`select count(*)::int as n from users`;
      return send(res, 200, { user, needsSetup: n === 0 });
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    const b = req.body || {};

    if (b.action === 'setup') {
      const [{ n }] = await sql`select count(*)::int as n from users`;
      if (n > 0) return send(res, 403, { error: 'Already set up' });
      const email = String(b.email || '').trim().toLowerCase(), name = String(b.name || '').trim();
      if (!name || !okEmail(email) || String(b.password || '').length < 10)
        return send(res, 400, { error: 'Enter a name, a valid email and a password of at least 10 characters' });
      const hash = await bcrypt.hash(String(b.password), 10);
      const [u] = await sql`insert into users (email, name, pw_hash, role) values (${email}, ${name}, ${hash}, 'admin') returning id, email, name, role`;
      return send(res, 200, { user: await startSession(res, u) });
    }

    if (b.action === 'login') {
      const email = String(b.email || '').trim().toLowerCase();
      const [u] = await sql`select * from users where email = ${email}`;
      if (!u || !(await bcrypt.compare(String(b.password || ''), u.pw_hash))) {
        await wait(500);
        return send(res, 401, { error: 'Wrong email or password' });
      }
      return send(res, 200, { user: await startSession(res, u) });
    }

    if (b.action === 'logout') {
      res.setHeader('Set-Cookie', cookie('', 0));
      return send(res, 200, { ok: true });
    }

    const me = await getUser(req);
    if (!me) return send(res, 401, { error: 'Sign in required' });

    if (b.action === 'createUser') {
      if (me.role !== 'admin') return send(res, 403, { error: 'Admins only' });
      const email = String(b.email || '').trim().toLowerCase(), name = String(b.name || '').trim();
      if (!name || !okEmail(email) || String(b.password || '').length < 10)
        return send(res, 400, { error: 'Enter a name, a valid email and a password of at least 10 characters' });
      const [dup] = await sql`select 1 as x from users where email = ${email}`;
      if (dup) return send(res, 409, { error: 'That email already has an account' });
      const hash = await bcrypt.hash(String(b.password), 10);
      await sql`insert into users (email, name, pw_hash, role) values (${email}, ${name}, ${hash}, 'staff')`;
      return send(res, 200, { ok: true });
    }

    if (b.action === 'password') {
      const [u] = await sql`select * from users where id = ${me.id}`;
      if (!u || !(await bcrypt.compare(String(b.current || ''), u.pw_hash))) return send(res, 401, { error: 'Current password is wrong' });
      if (String(b.password || '').length < 10) return send(res, 400, { error: 'New password must be at least 10 characters' });
      const hash = await bcrypt.hash(String(b.password), 10);
      await sql`update users set pw_hash = ${hash} where id = ${me.id}`;
      return send(res, 200, { ok: true });
    }

    return send(res, 400, { error: 'Unknown action' });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'Server error' });
  }
}
