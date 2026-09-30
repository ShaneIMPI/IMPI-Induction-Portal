const { db, verifyToken, ok, err, cors, retry } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();
  if (event.httpMethod !== 'GET') return err('Method not allowed', 405);

  const user = verifyToken(event);
  if (!user) return err('Unauthorized', 401);

  const event_id = event.queryStringParameters?.eventId;
  if (!event_id) return err('eventId required');

  const supabase = db();
  const PAGE_SIZE = 1000;

  // Same "page through everything" approach as completions.js, since either
  // table could pass 1000 rows for a big or long-running event.
  async function fetchAll(table, columns, orderCol) {
    let all = [];
    let from = 0;
    while (true) {
      const result = await retry(() =>
        supabase.from(table).select(columns).eq('event_id', event_id).order(orderCol, { ascending: true }).range(from, from + PAGE_SIZE - 1)
      );
      if (result.error) throw result.error;
      const page = result.data || [];
      all = all.concat(page);
      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return all;
  }

  try {
    const [completions, scans] = await Promise.all([
      fetchAll('completions', 'full_name,surname,id_number,company,role,cert_code,event_id', 'full_name'),
      fetchAll('attendance_scans', 'cert_code,scan_date,scanned_at', 'scan_date')
    ]);
    return ok({ completions, scans });
  } catch (e) {
    console.error('[attendance-report]', e);
    return err(e.message || 'Failed to load attendance report');
  }
};
