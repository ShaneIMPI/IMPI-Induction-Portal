const { db, ok, err, cors, retry } = require('./_shared');

// Marshals have no admin login/token — this is a separate, lighter door.
// The PIN is checked here, server-side, using the service-role key.
// It is deliberately never sent back to the browser or cached there:
// marshal.js caches the successful *session* (roster + event) instead,
// so a phone that has already logged in once for an event can resume
// scanning after a reload without needing the PIN again or a connection —
// but the PIN itself is never sitting in localStorage to be read out.
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return err('Invalid JSON'); }

  const event_id = (body.event_id || body.eventId || '').trim();
  const pin = (body.pin || '').trim();
  if (!event_id) return err('event_id required');
  if (!pin) return err('PIN required');

  const supabase = db();

  const evResult = await retry(() => supabase.from('events').select('id,name,marshal_pin').eq('id', event_id).single());
  if (evResult.error || !evResult.data) return err('Event not found', 404);
  const ev = evResult.data;

  if (!ev.marshal_pin) return err('No marshal PIN has been set for this event yet. Set one in Admin → Events.', 403);
  if (pin !== String(ev.marshal_pin)) return err('Incorrect PIN', 401);

  // The roster: everything the marshal's phone needs to accept or reject a
  // scan with zero further network calls. cert_code is what the QR encodes
  // and what a manual entry is checked against.
  const compResult = await retry(() =>
    supabase.from('completions').select('cert_code,full_name,surname,company,event_id,photo_url').eq('event_id', event_id)
  );
  if (compResult.error) { console.error('[marshal-login]', compResult.error); return err(compResult.error.message); }

  return ok({
    event_id: ev.id,
    event_name: ev.name,
    roster: compResult.data || []
  });
};
