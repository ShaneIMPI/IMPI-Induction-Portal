const { db, ok, err, cors, retry } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return err('Invalid JSON'); }

  const { fullName, surname, eventId, idNumber } = body;
  if (!fullName || !surname || !eventId) return err('fullName, surname, eventId required');

  const supabase = db();
  const result = await retry(() =>
    supabase.from('completions')
      .select('cert_code, id_number')
      .eq('event_id', eventId)
      .ilike('full_name', fullName.trim())
      .ilike('surname', surname.trim())
  );

  if (result.error) { console.error('[check-dup]', result.error); return err(result.error.message); }

  const matches = result.data || [];
  if (matches.length === 0) {
    return ok({ isDuplicate: false, alreadyCompleted: false });
  }

  // Same name AND same ID — person already completed legitimately
  const sameId = matches.find(r => r.id_number === idNumber);
  if (sameId) {
    return ok({ isDuplicate: false, alreadyCompleted: true, existingCode: sameId.cert_code });
  }

  // Same name BUT different ID — potential fraud/duplicate
  return ok({ isDuplicate: true, message: `${fullName} ${surname} has already completed this induction with a different ID.` });
};
