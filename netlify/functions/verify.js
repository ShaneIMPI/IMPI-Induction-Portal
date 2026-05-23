const { db, ok, err, cors, retry } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();
  if (event.httpMethod !== 'GET') return err('Method not allowed', 405);

  const code = (event.queryStringParameters?.code || '').trim().toUpperCase();
  if (!code) return err('Certificate code required');

  const supabase = db();
  const result = await retry(() =>
    supabase.from('completions').select('*').ilike('cert_code', code).maybeSingle()
  );

  if (result.error) { console.error('[verify]', result.error); return err(result.error.message); }
  if (!result.data) return ok({ valid: false, message: 'Certificate not found' });

  return ok({ valid: true, ...result.data });
};
