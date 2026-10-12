import { sql, getUser, send, readBody, toBuffer, UUID } from './_lib.js';

export default async function handler(req, res) {
  try {
    const me = await getUser(req);
    if (!me) return send(res, 401, { error: 'Sign in required' });

    if (req.method === 'POST') {
      const mime = String(req.headers['content-type'] || '').split(';')[0];
      if (!['image/jpeg', 'image/png'].includes(mime)) return send(res, 400, { error: 'JPEG or PNG only' });
      const buf = await readBody(req);
      if (buf.length < 100) return send(res, 400, { error: 'Empty image' });
      let name = 'image';
      try { name = decodeURIComponent(String(req.headers['x-name'] || 'image')).slice(0, 120); } catch {}
      const hex = '\\x' + buf.toString('hex');
      const [r] = await sql`insert into plan_images (name, mime, bytes, size, created_by) values (${name}, ${mime}, ${hex}::bytea, ${buf.length}, ${me.id}) returning id`;
      return send(res, 200, { id: r.id });
    }

    if (req.method === 'GET') {
      const id = (req.query || {}).id;
      if (!id || !UUID.test(id)) return send(res, 400, { error: 'Bad id' });
      const [r] = await sql`select mime, bytes from plan_images where id = ${id}`;
      if (!r) return send(res, 404, { error: 'Not found' });
      res.setHeader('Content-Type', r.mime);
      res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
      return res.status(200).send(toBuffer(r.bytes));
    }

    return send(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return send(res, e.status || 500, { error: e.status === 413 ? e.message : 'Server error' });
  }
}
