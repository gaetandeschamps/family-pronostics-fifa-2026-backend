const express = require('express');
const router = express.Router();
const { supabase } = require('../db/supabase');
const { authMiddleware } = require('../middleware/auth');
const { getVisiblePronostics } = require('../utils/pronosticRules');
const { syncTodayMatches } = require('../services/footballData');

const SYNC_COOLDOWN_SECONDS = 60;

async function syncIfNeeded(matches) {
  const now = new Date();
  const needsSync = matches.some(m =>
    ['IN_PLAY', 'PAUSED'].includes(m.status) ||
    (m.status === 'SCHEDULED' && new Date(m.kickoff_utc) - now < 30 * 60 * 1000)
  );
  if (!needsSync) return false;
  const lastSync = matches.reduce((latest, m) => {
    const t = m.last_synced_at ? new Date(m.last_synced_at) : new Date(0);
    return t > latest ? t : latest;
  }, new Date(0));
  if ((now - lastSync) / 1000 < SYNC_COOLDOWN_SECONDS) return false;
  await syncTodayMatches();
  return true;
}

async function getPlayersStatus(matchId, matchStatus, requestingUser) {
  const { data: players } = await supabase
    .schema('app_pronostics').from('users')
    .select('id, name').eq('role', 'player');

  const matchStarted = ['IN_PLAY', 'PAUSED', 'FINISHED'].includes(matchStatus);

  return Promise.all((players ?? []).map(async player => {
    const { data: pronostic } = await supabase
      .schema('app_pronostics').from('pronostics').select('*')
      .eq('match_id', matchId).eq('user_id', player.id).single();

    const isOwn = player.id === requestingUser.id;
    const showScores = matchStarted || isOwn || requestingUser.role === 'admin';

    return {
      player_id: player.id,
      name: player.name,
      has_predicted: !!pronostic,
      home_score_prediction: (showScores && pronostic) ? pronostic.home_score_prediction : null,
      away_score_prediction: (showScores && pronostic) ? pronostic.away_score_prediction : null,
    };
  }));
}

router.get('/today', authMiddleware, async (req, res) => {
  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(now); endOfDay.setUTCHours(23, 59, 59, 999);

  let { data: matches, error } = await supabase
    .schema('app_pronostics').from('matches').select('*')
    .gte('kickoff_utc', startOfDay.toISOString())
    .lte('kickoff_utc', endOfDay.toISOString())
    .order('kickoff_utc');
  if (error) return res.status(500).json({ error: error.message });

  const synced = await syncIfNeeded(matches).catch(() => false);
  if (synced) {
    const { data: fresh } = await supabase
      .schema('app_pronostics').from('matches').select('*')
      .gte('kickoff_utc', startOfDay.toISOString())
      .lte('kickoff_utc', endOfDay.toISOString())
      .order('kickoff_utc');
    matches = fresh ?? matches;
  }

  const results = await Promise.all(matches.map(async match => {
    const { data: pronostic } = await supabase
      .schema('app_pronostics').from('pronostics').select('*')
      .eq('match_id', match.id).eq('user_id', req.user.id).single();

    const players_status = await getPlayersStatus(match.id, match.status, req.user);

    return { match, my_pronostic: pronostic, players_status };
  }));
  res.json(results);
});

router.get('/all', authMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .schema('app_pronostics').from('matches').select('*').order('kickoff_utc');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/:id', authMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .schema('app_pronostics').from('matches').select('*')
    .eq('id', req.params.id).single();
  if (error) return res.status(404).json({ error: 'Match not found' });
  res.json(data);
});

router.get('/:id/pronostics', authMiddleware, async (req, res) => {
  const { data: match } = await supabase
    .schema('app_pronostics').from('matches').select('*').eq('id', req.params.id).single();
  if (!match) return res.status(404).json({ error: 'Match not found' });
  const { data: pronostics } = await supabase
    .schema('app_pronostics').from('pronostics')
    .select('*, user:user_id(name)').eq('match_id', req.params.id);
  const visible = getVisiblePronostics(
    req.user, match,
    (pronostics ?? []).map(p => ({ ...p, user_name: p.user?.name }))
  );
  res.json(visible);
});

module.exports = router;
