const { db, verifyToken, ok, err, cors, retry } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();

  const user = verifyToken(event);
  if (!user) return err('Unauthorized', 401);

  const supabase = db();

  if (event.httpMethod === 'GET') {
    const eventId = event.queryStringParameters?.eventId;

    // Supabase/PostgREST caps any single request at 1000 rows by default.
    // Page through in batches of 1000 until we've read everything, rather
    // than silently truncating once the table passes 1000 completions.
    const PAGE_SIZE = 1000;
    let allRows = [];
    let from = 0;
    while (true) {
      let query = supabase.from('completions')
        .select('*')
        .order('completed_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (eventId) query = query.eq('event_id', eventId);

      const result = await retry(() => query);
      if (result.error) { console.error('[completions GET]', result.error); return err(result.error.message); }

      const page = result.data || [];
      allRows = allRows.concat(page);
      if (page.length < PAGE_SIZE) break; // Last page reached.
      from += PAGE_SIZE;
    }

    return ok(allRows);
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
