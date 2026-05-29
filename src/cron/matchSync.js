const cron = require('node-cron');
const { syncFullCalendar, syncLiveMatches, syncTodayMatches } = require('../services/footballData');

function startCrons() {
  cron.schedule('0 3 * * *', async () => {
    console.log('[cron] Full calendar sync...');
    await syncFullCalendar().catch(e => console.error('[cron] Full sync error:', e.message));
  });
  cron.schedule('*/2 * * * *', async () => {
    await syncLiveMatches().catch(e => console.error('[cron] Live sync error:', e.message));
  });
  cron.schedule('*/30 * * * *', async () => {
    await syncTodayMatches().catch(e => console.error('[cron] Today sync error:', e.message));
  });
  console.log('Match sync crons started');
}

module.exports = { startCrons };
