/**
 * Manages per-event induction content (topics + quiz questions).
 * GET  /.netlify/functions/content?eventId=xxx  → returns content array (public)
 * POST /.netlify/functions/content               → { eventId, topics: [...] } (auth required)
 *
 * Topics array structure:
 * [
 *   {
 *     id: "t1",
 *     title: "Topic 1 — Safety File & Accreditation",
 *     body: "Description text...",
 *     warning: "⚠ Optional warning text",   // null if not used
 *     quiz_correct: "✓ Correct answer text",
 *     quiz_wrong: "Wrong answer text"
 *   },
 *   ...
 * ]
 *
 * Stored as JSONB in events.induction_content column.
 */

const { db, verifyToken, ok, err, cors } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();

  const supabase = db();

  if (event.httpMethod === 'GET') {
    const eventId = event.queryStringParameters?.eventId;
    if (!eventId) return err('eventId required');

    const { data, error } = await supabase
      .from('events')
      .select('induction_content')
      .eq('id', eventId)
      .single();

    if (error) return err(error.message, 404);
    return ok({ topics: data?.induction_content || null });
  }

  if (event.httpMethod === 'POST') {
    const user = verifyToken(event);
    if (!user) return err('Unauthorized', 401);

    const { eventId, topics } = JSON.parse(event.body || '{}');
    if (!eventId) return err('eventId required');
    if (!Array.isArray(topics)) return err('topics must be an array');

    const { error } = await supabase
      .from('events')
      .update({ induction_content: topics })
      .eq('id', eventId);

    if (error) return err(error.message);
    return ok({ success: true });
  }

  return err('Method not allowed', 405);
};
