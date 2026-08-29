const { db, ok, err, cors, retry } = require('./_shared');

function makeCertCode(name, idNumber) {
  const p1 = (name || 'XX').replace(/[^A-Z]/gi, '').slice(0, 2).toUpperCase().padEnd(2, 'X');
  const p2 = String(idNumber || '000').replace(/\D/g, '').slice(-3).padStart(3, '0');
  const p3 = Date.now().toString(36).slice(-3).toUpperCase();
  const p4 = Math.random().toString(36).slice(2, 4).toUpperCase();
  return (p1 + p2 + p3 + p4).slice(0, 8).toUpperCase();
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return err('Invalid JSON'); }

  const supabase = db();

  const full_name = body.full_name || body.fullName || '';
  const surname = body.surname || '';
  const id_number = body.id_number || body.idNumber || '';
  const id_type = body.id_type || body.idType || 'SA ID';
  const email = body.email || '';
  const phone = body.phone || '';
  const company = body.company || '';
  const trade = body.trade || '';
  const role = body.role || '';
  const event_id = body.event_id || body.eventId || '';
  const cert_code = body.cert_code || body.certCode || makeCertCode(full_name, id_number);
  const completed_at = body.completed_at || new Date().toISOString();
  const is_group = !!(body.is_group || body.isGroup);
  const group_members = Array.isArray(body.group_members || body.groupMembers) ? (body.group_members || body.groupMembers) : [];

  if (!full_name) return err('full_name required');
  if (!event_id) return err('event_id required');

  // Idempotency: if cert_code already exists, return success
  const { data: existing } = await supabase.from('completions').select('cert_code').eq('cert_code', cert_code).maybeSingle();
  if (existing) return ok({ success: true, cert_code, duplicate: true });

  const record = {
    full_name, surname, id_number, id_type,
    email, phone, company, trade, role,
    event_id, cert_code,
    completed_at
  };

  const saveResult = await retry(() => supabase.from('completions').insert([record]));
  if (saveResult.error) {
    console.error('[complete] save error:', saveResult.error);
    return err('Failed to save completion: ' + saveResult.error.message);
  }

  // Save group members (kept for backward compatibility with any future
  // caller that sends is_group/group_members in one payload — the current
  // induction.html flow submits each person as a separate /api/complete
  // call instead, so this path is not on the hot path today).
  if (is_group && group_members.length > 0) {
    const memberRecords = group_members.map(m => ({
      full_name: m.full_name || m.fullName,
      surname: m.surname,
      id_number: m.id_number || m.idNumber,
      id_type: m.id_type || m.idType || 'SA ID',
      email: m.email || email,
      phone: m.phone || phone,
      company,
      trade: m.trade || trade,
      role: m.role || role,
      event_id,
      cert_code: m.cert_code || makeCertCode(m.full_name || m.fullName, m.id_number || m.idNumber),
      completed_at
    }));
    for (const mr of memberRecords) {
      const { data: existingMember } = await supabase.from('completions').select('cert_code').eq('cert_code', mr.cert_code).maybeSingle();
      if (!existingMember) {
        const memberResult = await retry(() => supabase.from('completions').insert([mr]));
        if (memberResult.error) console.error('[complete group member]', memberResult.error.message);
      }
    }
  }
  return ok({ success: true, cert_code });
};
