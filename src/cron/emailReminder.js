const cron = require('node-cron');
const { supabase } = require('../db/supabase');
const { sendReminderEmail } = require('../services/emailService');
const { broadcastPush } = require('../services/pushService');

async function sendDailyReminders() {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const start = new Date(tomorrow); start.setUTCHours(0, 0, 0, 0);
  const end = new Date(tomorrow); end.setUTCHours(23, 59, 59, 999);

  const { data: matches } = await supabase.schema('fifa2026').from('matches').select('*')
    .gte('kickoff_utc', start.toISOString()).lte('kickoff_utc', end.toISOString()).eq('status', 'SCHEDULED');
  if (!matches?.length) return;

  const { data: players } = await supabase.schema('fifa2026').from('users').select('*').eq('role', 'player');
  for (const player of players ?? []) {
    const { data: done } = await supabase.schema('fifa2026').from('pronostics')
      .select('match_id').eq('user_id', player.id).in('match_id', matches.map(m => m.id));
    const doneIds = new Set(done?.map(p => p.match_id));
    const missing = matches.filter(m => !doneIds.has(m.id));
    if (!missing.length) continue;
    await sendReminderEmail(player, missing).catch(console.error);
    await broadcastPush([player.id], {
      title: 'Pronostics FIFA 2026',
      body: `Tu as ${missing.length} pronostic(s) à faire pour demain !`,
      url: process.env.FRONTEND_URL,
    }).catch(console.error);
  }
}

function startEmailCron() {
  cron.schedule('0 20 * * *', async () => {
    console.log('[cron] Sending daily reminders...');
    await sendDailyReminders().catch(e => console.error('[cron] Email reminder error:', e.message));
  });
  console.log('Email reminder cron started');
}

module.exports = { startEmailCron, sendDailyReminders };
