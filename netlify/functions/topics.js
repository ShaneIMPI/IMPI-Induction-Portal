const { db, verifyToken, ok, err, cors, retry } = require('./_shared');

const DEFAULT_TOPICS = [
  { id:'t1', topic_order:1, title:'Safety File & Accreditation', description:'All contractors and service providers must have a valid safety file on site. Health & Safety representatives must be clearly identified and accessible at all times.', correct_answer:'I understand and will ensure my safety file is on site.', wrong_answer:'I do not need a safety file for this event.' },
  { id:'t2', topic_order:2, title:'Personal Protective Equipment (PPE)', description:'Appropriate PPE must be worn at all times in designated areas. Hard hats, reflective vests, safety boots and gloves are required in build-up and breakdown zones.', correct_answer:'I will wear the required PPE in all designated areas.', wrong_answer:'PPE is optional and only worn when I feel it is necessary.' },
  { id:'t3', topic_order:3, title:'Emergency Procedures & Exits', description:'Familiarise yourself with all emergency exits, assembly points and evacuation routes. In an emergency: stay calm, do not run, follow marshals\' instructions and proceed to the nearest assembly point.', correct_answer:'I know the emergency exits and will follow evacuation procedures.', wrong_answer:'I will decide my own exit route during an emergency.' },
  { id:'t4', topic_order:4, title:'Fire Safety', description:'No open flames or unauthorised heat sources are permitted. Know the location of fire extinguishers. Do not obstruct fire hose reels, extinguishers or fire exits at any time.', correct_answer:'I will not obstruct fire safety equipment and will follow fire procedures.', wrong_answer:'Fire safety equipment can be moved if it is in my way.' },
  { id:'t5', topic_order:5, title:'Working at Heights', description:'Any work above 1.5 metres requires appropriate fall protection. Scaffolding and elevated platforms must be inspected before use. Never work at heights without an approved harness and anchor point.', correct_answer:'I will use approved fall protection for any work above 1.5 metres.', wrong_answer:'I can use any available structure as a working platform.' },
  { id:'t6', topic_order:6, title:'Electrical Safety', description:'Only qualified electricians may work on electrical installations. Do not overload power circuits. Report exposed wiring, damaged equipment or sparking immediately to the safety officer.', correct_answer:'I will report any electrical hazards immediately and not attempt repairs myself.', wrong_answer:'Minor electrical issues can be fixed by anyone on site.' },
  { id:'t7', topic_order:7, title:'Housekeeping & Waste Management', description:'Maintain a clean and tidy workspace at all times. All waste must be correctly sorted and disposed of in designated areas. Passageways and emergency routes must remain clear at all times.', correct_answer:'I will keep my workspace clean and dispose of waste correctly.', wrong_answer:'Waste can be left on site for others to clear.' }
];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors();
  const supabase = db();

  if (event.httpMethod === 'GET') {
    const eventId = event.queryStringParameters?.eventId;

    // 1. Try event-specific topics
    if (eventId) {
      const result = await retry(() =>
        supabase.from('induction_topics').select('*').eq('event_id', eventId).order('topic_order')
      );
      if (!result.error && result.data?.length > 0) return ok(result.data);
    }

    // 2. Try global topics
    const globalResult = await retry(() =>
      supabase.from('induction_topics').select('*').eq('event_id', 'global').order('topic_order')
    );
    if (!globalResult.error && globalResult.data?.length > 0) return ok(globalResult.data);

    // 3. Hardcoded defaults
    return ok(DEFAULT_TOPICS);
  }

  const user = verifyToken(event);
  if (!user) return err('Unauthorized', 401);

  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return err('Invalid JSON'); }
    const { eventId, topics } = body;
    if (!eventId) return err('eventId required');
    if (!Array.isArray(topics)) return err('topics must be an array');

    // Replace all topics for this event/global scope
    await supabase.from('induction_topics').delete().eq('event_id', eventId);
    if (topics.length > 0) {
      const rows = topics.map((t, i) => ({
        event_id: eventId,
        topic_order: t.topic_order ?? i + 1,
        title: t.title,
        description: t.description,
        correct_answer: t.correct_answer,
        wrong_answer: t.wrong_answer,
        correct_img_url: t.correct_img_url || null,
        wrong_img_url: t.wrong_img_url || null
      }));
      const { error } = await supabase.from('induction_topics').insert(rows);
      if (error) { console.error('[topics POST]', error); return err(error.message); }
    }
    return ok({ success: true });
  }

  if (event.httpMethod === 'DELETE') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return err('Invalid JSON'); }
    const { eventId } = body;
    if (!eventId) return err('eventId required');
    await supabase.from('induction_topics').delete().eq('event_id', eventId);
    return ok({ success: true });
  }

  return err('Method not allowed', 405);
};
