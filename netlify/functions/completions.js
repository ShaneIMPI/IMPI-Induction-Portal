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
