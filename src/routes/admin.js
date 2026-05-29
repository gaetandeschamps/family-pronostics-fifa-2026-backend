const express = require('express');
const router = express.Router();
const { supabase } = require('../db/supabase');
const { authMiddleware } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleCheck');
const { syncFullCalendar } = require('../services/footballData');
const { calculateEarnings } = require('../utils/earnings');

router.use(authMiddleware, requireAdmin);

router.get('/pronostics', async (req, res) => {
  const { data, error } = await supabase
    .schema('app_pronostics').from('pronostics')
    .select('*, user:user_id(name, email), match:match_id(*)')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/sync-matches', async (req, res) => {
  try {
    await syncFullCalendar();
    res.json({ message: 'Sync completed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/api-status', async (req, res) => {
  const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'FOOTBALL_DATA_API_KEY not set' });

  const response = await fetch('https://api.football-data.org/v4/competitions/WC', {
    headers: { 'X-Auth-Token': API_KEY }
  }).catch(e => null);

  if (!response) return res.status(500).json({ error: 'Could not reach football-data.org' });

  res.json({
    status: response.status === 200 ? 'ok' : 'error',
    requests_available_minute: response.headers.get('X-Requests-Available-Minute'),
    requests_counter_reset: response.headers.get('X-RequestCounter-Reset'),
    plan: response.headers.get('X-Auth-Token-Scope') || 'unknown',
  });
});

router.put('/matches/:id/score', async (req, res) => {
  const { home_score, away_score } = req.body;
  if (home_score === undefined || away_score === undefined) {
    return res.status(400).json({ error: 'Missing scores' });
  }
  const { data: match, error } = await supabase
    .schema('app_pronostics').from('matches')
    .update({ home_score, away_score, status: 'FINISHED' })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  const { data: pronostics } = await supabase
    .schema('app_pronostics').from('pronostics').select('*').eq('match_id', req.params.id);
  for (const p of pronostics ?? []) {
    const earnings = calculateEarnings(p, match);
    await supabase.schema('app_pronostics').from('pronostics')
      .update({ earnings, is_locked: true }).eq('id', p.id);
  }
  res.json(match);
});

module.exports = router;
