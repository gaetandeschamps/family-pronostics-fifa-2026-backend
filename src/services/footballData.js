const { supabase } = require('../db/supabase');

const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const BASE_URL = 'https://api.football-data.org/v4';

async function fetchFootball(path) {
  if (!API_KEY) throw new Error('FOOTBALL_DATA_API_KEY not set');
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'X-Auth-Token': API_KEY }
  });
  if (!res.ok) throw new Error(`football-data API error: ${res.status}`);
  return res.json();
}

function mapStatus(s) {
  return { SCHEDULED: 'SCHEDULED', TIMED: 'SCHEDULED', IN_PLAY: 'IN_PLAY',
    PAUSED: 'PAUSED', FINISHED: 'FINISHED', POSTPONED: 'POSTPONED' }[s] || 'SCHEDULED';
}

async function syncFullCalendar() {
  const data = await fetchFootball('/competitions/WC/matches');
  for (const m of data.matches ?? []) {
    await supabase.schema('app_pronostics').from('matches').upsert({
      external_id: m.id, stage: m.stage, group_name: m.group || null,
      match_day: m.matchday || null,
      home_team_name: m.homeTeam.name || 'TBD', home_team_code: m.homeTeam.tla || 'TBD',
      away_team_name: m.awayTeam.name || 'TBD', away_team_code: m.awayTeam.tla || 'TBD',
      venue: m.venue || null, kickoff_utc: m.utcDate, status: mapStatus(m.status),
      home_score: m.score?.fullTime?.home ?? null, away_score: m.score?.fullTime?.away ?? null,
      last_synced_at: new Date().toISOString(),
    }, { onConflict: 'external_id' });
  }
  console.log(`Synced ${data.matches?.length ?? 0} matches`);
}

async function syncLiveMatches() {
  const data = await fetchFootball('/competitions/WC/matches?status=LIVE').catch(() => null);
  if (!data) return;
  for (const m of data.matches ?? []) {
    const { data: updated } = await supabase.schema('app_pronostics').from('matches').update({
      status: mapStatus(m.status),
      home_score: m.score?.fullTime?.home ?? null,
      away_score: m.score?.fullTime?.away ?? null,
      last_synced_at: new Date().toISOString(),
    }).eq('external_id', m.id).select().single();
    if (updated?.status === 'FINISHED') await recalculateEarnings(updated);
  }
}

async function syncTodayMatches() {
  const today = new Date().toISOString().split('T')[0];
  const data = await fetchFootball(`/competitions/WC/matches?dateFrom=${today}&dateTo=${today}`).catch(() => null);
  if (!data) return;
  for (const m of data.matches ?? []) {
    await supabase.schema('app_pronostics').from('matches').update({
      status: mapStatus(m.status),
      home_score: m.score?.fullTime?.home ?? null,
      away_score: m.score?.fullTime?.away ?? null,
      last_synced_at: new Date().toISOString(),
    }).eq('external_id', m.id);
  }
}

async function recalculateEarnings(match) {
  const { calculateEarnings } = require('../utils/earnings');
  const { data: pronostics } = await supabase
    .schema('app_pronostics').from('pronostics').select('*').eq('match_id', match.id);
  for (const p of pronostics ?? []) {
    const earnings = calculateEarnings(p, match);
    await supabase.schema('app_pronostics').from('pronostics')
      .update({ earnings, is_locked: true }).eq('id', p.id);
  }
}

module.exports = { syncFullCalendar, syncLiveMatches, syncTodayMatches };
