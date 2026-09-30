const { db, ok, err, cors, retry } = require('./_shared');

// No admin token here either — a marshal's phone calls this directly once
// it has an accepted scan queued. What actually protects this endpoint from
// junk data is that it only ever gets called with a cert_code the phone
// already validated against its own downloaded roster (see marshal.js) —
// this function itself still re-validates cert_code/event_id server-side
// before writing, so a stray or malformed request can't pollute the table.
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return err('Invalid JSON'); }

  const event_id = (body.event_id || body.eventId || '').trim();
  const cert_code = (body.cert_code || body.certCode || '').trim().toUpperCase();
  const scan_date = body.scan_date || body.scanDate;
  const scanned_at = body.scanned_at || body.scannedAt || new Date().toISOString();
  const marshal_name = body.marshal_name || body.marshalName || null;
  const client_scan_id = body.client_scan_id || body.clientScanId;

  if (!event_id) return err('event_id required');
  if (!cert_code) return err('cert_code required');
  if (!scan_date) return err('scan_date required');
  if (!client_scan_id) return err('client_scan_id required');

  const supabase = db();

  // Confirm this certificate actually belongs to this event before writing
  // anything — the phone already checked this against its cached roster,
  // this is the server-side backstop.
  const compResult = await retry(() =>
    supabase.from('completions').select('cert_code,full_name,company,event_id').eq('cert_code', cert_code).maybeSingle()
  );
  if (compResult.error) { console.error('[attendance-scan lookup]', compResult.error); return err(compResult.error.message); }
  if (!compResult.data) return err('Certificate not found', 404);
  if (compResult.data.event_id !== event_id) return err('Certificate belongs to a different event', 409);

  const record = {
    event_id,
    cert_code,
    full_name: compResult.data.full_name,
    company: compResult.data.company,
    scan_date,
    scanned_at,
    marshal_name,
    client_scan_id
  };

  const insertResult = await retry(() => supabase.from('attendance_scans').insert([record]));
  if (insertResult.error) {
    // 23505 = unique_violation — this person already has a scan today.
    // That's not a failure: the first scan of the day already won, exactly
    // as intended, so tell the phone it's synced rather than erroring.
    if (insertResult.error.code === '23505') {
      return ok({ success: true, already_recorded: true });
    }
    console.error('[attendance-scan insert]', insertResult.error);
    return err(insertResult.error.message);
  }

  return ok({ success: true, already_recorded: false });
};
