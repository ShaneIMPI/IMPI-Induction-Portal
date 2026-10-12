import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getUser } from './_lib.js';

let html = null;

// Serves the FloorPlan Studio app only to signed-in users.
export default async function handler(req, res) {
  const user = await getUser(req);
  res.setHeader('Cache-Control', 'no-store');
  if (!user) {
    res.statusCode = 302;
    res.setHeader('Location', '/');
    return res.end();
  }
  try {
    if (!html) html = readFileSync(join(process.cwd(), 'private', 'app.html'), 'utf8');
    const u = JSON.stringify({ id: user.id, name: user.name, email: user.email, role: user.role }).replace(/</g, '\\u003c');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const mb = (process.env.MAPBOX_TOKEN || '').trim();
    const cfg = JSON.stringify({ mapbox: /^pk\./.test(mb) ? mb : '' }).replace(/</g, '\\u003c');
    return res.status(200).send(html.replace('window.__FPS_USER=null;window.__FPS_CFG=null;', 'window.__FPS_USER=' + u + ';window.__FPS_CFG=' + cfg + ';'));
  } catch (e) {
    console.error(e);
    return res.status(500).send('App file missing. Check that the private folder was deployed.');
  }
}
