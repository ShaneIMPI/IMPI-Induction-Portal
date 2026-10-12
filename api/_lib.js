import { neon } from '@neondatabase/serverless';
import { SignJWT, jwtVerify } from 'jose';

export const sql = neon(process.env.DATABASE_URL);
const key = () => new TextEncoder().encode(process.env.JWT_SECRET);
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function makeToken(u) {
  return await new SignJWT({ role: u.role, name: u.name, email: u.email })
    .setProtectedHeader({ alg: 'HS256' }).setSubject(u.id).setIssuedAt().setExpirationTime('14d').sign(key());
}
export function cookie(token, maxAge) {
  return `session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}
export async function getUser(req) {
  const m = (req.headers.cookie || '').match(/(?:^|;\s*)session=([^;]+)/);
  if (!m) return null;
  try {
    const { payload } = await jwtVerify(m[1], key());
    return { id: payload.sub, role: payload.role, name: payload.name, email: payload.email };
  } catch { return null; }
}
export function send(res, code, obj) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(code).json(obj);
}
export async function readBody(req, limit = 4_400_000) {
  const chunks = []; let n = 0;
  for await (const c of req) {
    n += c.length;
    if (n > limit) throw Object.assign(new Error('File too large (max 4 MB)'), { status: 413 });
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}
export function toBuffer(v) {
  if (Buffer.isBuffer(v)) return v;
  if (typeof v === 'string' && v.startsWith('\\x')) return Buffer.from(v.slice(2), 'hex');
  return Buffer.from(v);
}
