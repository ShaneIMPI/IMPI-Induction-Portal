import { sql, getUser, send, UUID } from './_lib.js';

export default async function handler(req, res) {
  try {
    const me = await getUser(req);
    if (!me) return send(res, 401, { error: 'Sign in required' });
    const q = req.query || {};
    if (q.id && !UUID.test(q.id)) return send(res, 400, { error: 'Bad id' });

    if (req.method === 'GET') {
      if (!q.id) {
        const plans = await sql`
          select p.id, p.title, p.event, p.venue, p.client, p.ref, p.updated_at, u.name as by,
                 (select max(rev_no) from plan_revisions r where r.plan_id = p.id) as rev_no
          from plans p left join users u on u.id = p.created_by
          where not p.archived order by p.updated_at desc limit 200`;
        return send(res, 200, { plans });
      }
      const [plan] = await sql`select id, title, event, venue, client, ref, updated_at from plans where id = ${q.id} and not archived`;
      if (!plan) return send(res, 404, { error: 'Plan not found' });
      if (q.revs) {
        const revs = await sql`
          select r.rev_no, r.label, r.note, r.created_at, u.name as by
          from plan_revisions r left join users u on u.id = r.created_by
          where r.plan_id = ${q.id} order by r.rev_no desc`;
        return send(res, 200, { plan, revs });
      }
      const [revision] = q.rev
        ? await sql`select rev_no, label, data, created_at from plan_revisions where plan_id = ${q.id} and rev_no = ${parseInt(q.rev, 10)}`
        : await sql`select rev_no, label, data, created_at from plan_revisions where plan_id = ${q.id} order by rev_no desc limit 1`;
      if (!revision) return send(res, 404, { error: 'Revision not found' });
      return send(res, 200, { plan, revision });
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.data || typeof b.data !== 'object') return send(res, 400, { error: 'Missing plan data' });
      const m = b.data.meta || {};
      const fields = { title: String(m.title || '').slice(0, 200), event: String(m.event || '').slice(0, 200), venue: String(m.venue || '').slice(0, 200), client: String(m.client || '').slice(0, 200), ref: String(m.ref || '').slice(0, 100) };
      let planId = b.planId;
      if (planId) {
        if (!UUID.test(planId)) return send(res, 400, { error: 'Bad plan id' });
        const [ex] = await sql`select id from plans where id = ${planId} and not archived`;
        if (!ex) return send(res, 404, { error: 'Plan not found' });
      } else {
        const [p] = await sql`insert into plans (title, event, venue, client, ref, created_by) values (${fields.title}, ${fields.event}, ${fields.venue}, ${fields.client}, ${fields.ref}, ${me.id}) returning id`;
        planId = p.id;
      }
      const [{ n }] = await sql`select coalesce(max(rev_no), 0) + 1 as n from plan_revisions where plan_id = ${planId}`;
      await sql`insert into plan_revisions (plan_id, rev_no, label, note, data, created_by)
                values (${planId}, ${n}, ${String(b.label || '').slice(0, 60)}, ${String(b.note || '').slice(0, 500)}, ${JSON.stringify(b.data)}::jsonb, ${me.id})`;
      await sql`update plans set title = ${fields.title}, event = ${fields.event}, venue = ${fields.venue}, client = ${fields.client}, ref = ${fields.ref}, updated_at = now() where id = ${planId}`;
      return send(res, 200, { planId, rev_no: Number(n) });
    }

    if (req.method === 'DELETE') {
      if (!q.id) return send(res, 400, { error: 'Missing id' });
      const [p] = await sql`select created_by from plans where id = ${q.id}`;
      if (!p) return send(res, 404, { error: 'Plan not found' });
      if (me.role !== 'admin' && p.created_by !== me.id) return send(res, 403, { error: 'Only the owner or an admin can archive a plan' });
      await sql`update plans set archived = true, updated_at = now() where id = ${q.id}`;
      return send(res, 200, { ok: true });
    }

    return send(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'Server error' });
  }
}
