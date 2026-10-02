const { db, ok, err, cors, retry } = require('./_shared');

// A lighter roster refresh for a device that has already completed
// /api/marshal-login once for this event. No PIN here — a marshal
// refreshing the list mid-shift isn't a new login; the PIN's job (deciding
// who gets to START scanning for an event) is already done by that point.
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();
  if (event.httpMethod !== 'GET') return err('Method not allowed', 405);

  const event_id = event.queryStringParameters?.eventId;
  if (!event_id) return err('eventId required');

  const supabase = db();
  const result = await retry(() =>
    supabase.from('completions').select('cert_code,full_name,surname,company,event_id,photo_url').eq('event_id', event_id)
  );
  if (result.error) { console.error('[marshal-roster]', result.error); return err(result.error.message); }
  return ok({ roster: result.data || [] });
};
