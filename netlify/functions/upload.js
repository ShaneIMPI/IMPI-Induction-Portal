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

  const file       = parts.find(p => p.name === 'file');
  const eventId    = parts.find(p => p.name === 'eventId')?.data?.toString().trim();
  const type       = parts.find(p => p.name === 'type')?.data?.toString().trim();
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

  // Topic image → storage only, URL returned for saving via topics API
  if (type === 'topic_image') {
    if (!settingKey) return err('settingKey required for topic images');
    const path = `topic-images/${settingKey}-${ts}-${file.filename}`;
    const { error: uploadErr } = await supabase.storage
      .from('event-files')
      .upload(path, file.data, { contentType: mime, upsert: true });
    if (uploadErr) { console.error('[upload topic img]', uploadErr); return err('Storage upload failed: ' + uploadErr.message); }
    const { data: { publicUrl } } = supabase.storage.from('event-files').getPublicUrl(path);
    return ok({ url: publicUrl, name: file.filename });
  }

  // Event file (logo or PDF)
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
