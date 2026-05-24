const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const newTopics = [
  {
    event_id: 'global',
    topic_order: 12,
    title: 'Hot Works & Cutting',
    description: 'Hot works — including welding, angle grinding, cutting, soldering, and the use of open-flame equipment — are strictly controlled on all IMPI-managed event sites. A Hot Work Permit must be obtained from the Safety Manager before any hot work commences. A trained fire watcher must be stationed in the immediate area for the full duration of all hot works and for a minimum of 30 minutes after completion to monitor for smouldering or delayed ignition. All flammable materials must be removed or shielded from the work area. Failure to comply will result in immediate work stoppage.',
    correct_answer: 'Obtain a valid Hot Work Permit from the Safety Manager before starting. Ensure a trained fire watcher is present throughout the work and for at least 30 minutes after completion. Remove all flammable materials from the area beforehand.',
    wrong_answer: 'Quick angle grinding does not require a permit — you only need authorisation for welding or open-flame work. As long as you work quickly and keep a bucket of water nearby, you can proceed without a fire watcher.',
  },
  {
    event_id: 'global',
    topic_order: 13,
    title: 'Ladder Safety & Use',
    description: 'All ladders used on site must be inspected before each use for damage, missing rungs, or defective locking mechanisms. Ladders must extend at least 1 metre above the intended working level or landing point. Always maintain three points of contact when climbing or descending. Ladders must be secured at the top and footed or tied at the base to prevent movement — a second person must hold the base if the ladder cannot be secured. Never overreach or lean sideways from a ladder. Do not use a ladder as a working platform for tasks exceeding 30 minutes — use an appropriate elevated work platform instead.',
    correct_answer: 'Inspect the ladder before use, ensure it extends at least 1 metre above the working level, secure it at the top and have someone foot it at the base. Maintain three points of contact at all times and never overreach.',
    wrong_answer: 'If the ladder looks undamaged and is the right height, you can proceed without securing it — as long as you are careful and keep your movements slow, it will be stable enough for a short task.'
  }
];

async function seed() {
  // Remove any existing global topics 12 & 13 to avoid duplicates
  for (const topic of newTopics) {
    const { error: delErr } = await supabase
      .from('induction_topics')
      .delete()
      .eq('event_id', 'global')
      .eq('topic_order', topic.topic_order);
    if (delErr) console.warn(`Delete warning (order ${topic.topic_order}):`, delErr.message);
  }

  const { data, error } = await supabase.from('induction_topics').insert(newTopics).select();
  if (error) {
    console.error('Seed failed:', error.message);
    process.exit(1);
  }
  console.log('Seeded topics 12 & 13:', data.map(t => `[${t.topic_order}] ${t.title}`).join(', '));
}

seed();
