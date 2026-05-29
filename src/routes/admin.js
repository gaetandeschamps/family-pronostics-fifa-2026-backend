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
    .schema('fifa2026').from('pronostics')
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

router.put('/matches/:id/score', async (req, res) => {
  const { home_score, away_score } = req.body;
  if (home_score === undefined || away_score === undefined) {
    return res.status(400).json({ error: 'Missing scores' });
  }
  const { data: match, error } = await supabase
    .schema('fifa2026').from('matches')
    .update({ home_score, away_score, status: 'FINISHED' })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  const { data: pronostics } = await supabase
    .schema('fifa2026').from('pronostics').select('*').eq('match_id', req.params.id);
  for (const p of pronostics ?? []) {
    const earnings = calculateEarnings(p, match);
    await supabase.schema('fifa2026').from('pronostics')
      .update({ earnings, is_locked: true }).eq('id', p.id);
  }
  res.json(match);
});

module.exports = router;
