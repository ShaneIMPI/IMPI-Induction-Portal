// netlify/functions/check-duplicate.js
const { db, ok, err, cors } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405);

  const { fullName, surname, eventId, idNumber } = JSON.parse(event.body || '{}');
  if (!fullName || !surname || !eventId) return err('Missing required fields');

  const supabase = db();
  const { data, error } = await supabase
    .from('completions')
    .select('cert_code, id_number')
    .eq('event_id', eventId)
    .ilike('full_name', fullName)
    .ilike('surname', surname);

  if (error) return err(error.message);
  if (!data || data.length === 0) {
    return ok({ isDuplicate: false, hasSameId: false, existingCode: null });
  }

  const sameId = data.find(r => r.id_number === idNumber);
  if (sameId) {
    return ok({ isDuplicate: true, hasSameId: true, existingCode: sameId.cert_code });
  }
  return ok({ isDuplicate: true, hasSameId: false, existingCode: null });
};
