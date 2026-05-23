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
